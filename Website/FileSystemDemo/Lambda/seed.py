"""Future, separately approved seed migration. The default never contacts AWS."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from uuid import uuid4
from models.records import timestamp
from services.workspace import Snapshot
from validators import normalize
from Shared.catalog_baseline import source_products

MANIFEST = Path(__file__).resolve().parents[1] / 'catalog-seed.json'


def fingerprint(product):
    return hashlib.sha256(json.dumps(product, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def plan(database):
    state = Snapshot(database)
    rows = []
    for source in source_products():
        current = state.products.get(source['sku'])
        same = current and current.get('seed_signature') == fingerprint(source) and int(current.get('revision', 0)) == int(current.get('seed_initial_revision', 1)) and current.get('status') == 'PUBLISHED' and all(current.get(key) == value for key, value in source.items())
        action = 'CREATE' if not current else 'UNCHANGED' if same else 'CONFLICT'
        rows.append({'sku': source['sku'], 'action': action, 'proposed': {**source, 'status': 'PUBLISHED'}, **({'existing': {key: current.get(key) for key in (*source.keys(), 'status', 'revision')}} if current and not same else {})})
    return rows


def apply(database):
    if any(row['action'] == 'CONFLICT' for row in plan(database)):
        raise RuntimeError('Seed conflicts require manual review; nothing was overwritten')
    for source in source_products():
        state = Snapshot(database)
        if source['sku'] in state.products:
            # Recheck before skipping; administrator edits are never overwritten.
            if next(row for row in plan(database) if row['sku'] == source['sku'])['action'] != 'UNCHANGED':
                raise RuntimeError('Seed record changed during migration')
            continue
        now = timestamp()
        initial_revision = state.next_product_revision()
        state.products[source['sku']] = {**source, 'product_id': str(uuid4()), 'normalized_name': normalize(source['name']), 'status': 'PUBLISHED', 'revision': initial_revision, 'seed_initial_revision': initial_revision, 'tag_ids': [], 'created_at': now, 'updated_at': now, 'seed_signature': fingerprint(source)}
        state.commit()
    return plan(database)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not args.live:
        if args.apply:
            parser.error('--apply requires separately reviewed --live mode')
        print(json.dumps({'mode': 'offline-source-preview', 'products': source_products()}, indent=2))
        return
    import boto3
    from repositories.catalog_repository import CatalogRepository
    account, catalog, filesystem = (os.environ[key] for key in ('VERIFIED_ACCOUNT', 'CATALOG_TABLE', 'FILESYSTEM_TABLE'))
    session = boto3.Session(profile_name=os.environ['VERIFIED_PROFILE'], region_name='us-east-2')
    caller = session.client('sts').get_caller_identity()
    if caller['Account'] != account or caller['Arn'].endswith(':root'):
        raise RuntimeError('Seed caller differs from verified non-root identity')
    db = CatalogRepository(session.client('dynamodb'), catalog, filesystem)
    rows = plan(db)
    print(json.dumps(rows, indent=2))
    if args.apply:
        phrase = f'SEED {account} {catalog}'
        if not os.isatty(0) or input(f'Type {phrase}: ').strip() != phrase:
            raise RuntimeError('Seed writes were not approved')
        print(json.dumps(apply(db), indent=2))


if __name__ == '__main__':
    main()
