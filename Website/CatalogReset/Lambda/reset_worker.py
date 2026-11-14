"""Prepare an invisible product generation, then atomically publish it once/day.

Never deletes document/tag definitions or touches orders. Inactive generations
are retained as recovery evidence; a code rollback cannot restore catalog data.
"""
from collections import Counter
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import hashlib
import json
import logging
import os
from pathlib import Path
import random
import time
from uuid import uuid4
from zoneinfo import ZoneInfo
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from Shared.catalog_baseline import BASELINE, source_products
from Shared.catalog_repository import catalog_control, control_condition, decode, encode, product_partition, DynamoCatalog
from models.records import projections
from validators import normalize

logger = logging.getLogger(__name__)
MAX_PRODUCTS, MAX_TAGS, MAX_ATTEMPTS = 40, 30, 3


def eastern_zone():
    with Path(__file__).with_name('America_New_York.tzif').open('rb') as stream:
        return ZoneInfo.from_file(stream, key='America/New_York')


def intended_day(value, now):
    if not isinstance(value, str) or not value.endswith('Z'):
        raise ValueError('A scheduled UTC timestamp is required')
    scheduled = datetime.fromisoformat(value.replace('Z', '+00:00'))
    local = scheduled.astimezone(eastern_zone())
    if (local.hour, local.minute, local.second, local.microsecond) != (0, 0, 0, 0):
        raise ValueError('Timestamp must identify intended midnight America/New_York')
    if scheduled > now + timedelta(seconds=60):
        raise ValueError('Future scheduled delivery')
    return local.date().isoformat(), scheduled


class ResetWorker:
    def __init__(self, client, table, clock=lambda: datetime.now(timezone.utc), sleep=time.sleep):
        self.client, self.table, self.clock, self.sleep = client, table, clock, sleep

    def get(self, pk, sk='META'):
        return decode(self.client.get_item(TableName=self.table, Key=encode({'PK': pk, 'SK': sk}), ConsistentRead=True).get('Item'))

    def query(self, pk, maximum):
        response = self.client.query(TableName=self.table, KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues=encode({':pk': pk}), ConsistentRead=True, Limit=maximum + 1)
        if not isinstance(response.get('Items'), list) or response.get('LastEvaluatedKey') or len(response['Items']) > maximum:
            raise RuntimeError('Unverified catalog bound')
        return [decode(item) for item in response['Items']]

    def transact(self, rows, token):
        if not 1 <= len(rows) <= 100 or len(json.dumps(rows)) > 3_000_000:
            raise RuntimeError('Unsafe reset transaction bounds')
        self.client.transact_write_items(TransactItems=rows, ClientRequestToken=hashlib.sha256(token.encode()).hexdigest()[:32])

    def prepare(self, day, control):
        current = self.get('RESET#' + day)
        if current and current.get('state') == 'COMPLETED':
            return current
        if current and current.get('state') == 'PREPARING':
            plan = self.get('RESET#' + day, 'PLAN#' + current['generation'])
            if not plan or self.plan_digest(plan) != current.get('plan_sha256'):
                raise RuntimeError('Reset plan is missing or unverified')
            if plan['source_control'] == control:
                return plan
        products = self.query(product_partition('PRODUCTS', control), MAX_PRODUCTS)
        tags = self.query('TAGS', MAX_TAGS)
        for item in products:
            DynamoCatalog.validate(item, item.get('SK'))
        prior = {p['sku']: p for p in products}
        fence = max([int(control.get('product_revision_fence', 0)), int(control['revision']), *[int(p['revision']) for p in products]]) + 1
        now = self.clock().isoformat().replace('+00:00', 'Z')
        defaults = []
        for source in source_products():
            old = prior.get(source['sku'], {})
            defaults.append({**source, 'normalized_name': normalize(source['name']), 'status': 'PUBLISHED',
                'tag_ids': [], 'revision': fence, 'product_id': old.get('product_id', str(uuid4())),
                'created_at': old.get('created_at', now), 'updated_at': now})
        counts = Counter(tag for item in products if not item.get('deleted') for tag in item.get('tag_ids', []))
        if set(counts) - {tag['id'] for tag in tags}:
            raise RuntimeError('Unknown product tag; reset requires review')
        tag_updates = []
        for tag in tags:
            removed = counts[tag['id']]
            if removed:
                if tag['reference_count'] < removed:
                    raise RuntimeError('Inconsistent tag reference count')
                tag_updates.append({**tag, 'reference_count': tag['reference_count'] - removed})
        if catalog_control(self.client, self.table) != control:
            raise Conflict('Workspace changed during preparation')
        generation = uuid4().hex
        job = {'PK': 'RESET#' + day, 'SK': 'PLAN#' + generation, 'state': 'PREPARING', 'day': day,
               'generation': generation, 'baseline_version': BASELINE['version'], 'source_control': control,
               'defaults': defaults, 'tag_updates': tag_updates, 'fence': fence, 'prepared_at': now}
        # Keep the guarded owner/audit row small. Its conditional writes must
        # not be billed for replacing a large embedded plan during activation.
        owner = {key:value for key,value in job.items() if key not in ('defaults','tag_updates','source_control')}
        owner.update(SK='META', plan_sha256=self.plan_digest(job))
        condition = ({'ConditionExpression':'generation = :old AND #state = :preparing',
                      'ExpressionAttributeNames':{'#state':'state'}, 'ExpressionAttributeValues':encode({':old':current['generation'], ':preparing':'PREPARING'})}
                     if current else {'ConditionExpression':'attribute_not_exists(PK)'})
        self.transact([
            {'ConditionCheck':{'TableName':self.table,'Key':encode({'PK':'CONTROL','SK':'META'}),**control_condition(control)}},
            {'Put':{'TableName':self.table,'Item':encode(owner),**condition}},
            {'Put':{'TableName':self.table,'Item':encode(job),'ConditionExpression':'attribute_not_exists(PK)'}}
        ], generation + '-prepare')
        return job

    @staticmethod
    def plan_digest(plan):
        return hashlib.sha256(json.dumps(encode(plan),sort_keys=True,separators=(',',':')).encode()).hexdigest()

    def stage(self, job):
        rows = []
        control = {'product_generation': job['generation']}
        for item in job['defaults']:
            rows.append({'Put': {'TableName': self.table, 'Item': encode({**item,
                'PK': product_partition('PRODUCTS', control), 'SK': item['sku']})}})
            for (pk, sk), value in projections(item, 'PRODUCT').items():
                rows.append({'Put': {'TableName': self.table, 'Item': encode({**value, 'PK':product_partition(pk, control), 'SK':sk})}})
        for offset in range(0, len(rows), 20):
            # Pace guarded stage transactions instead of creating a write/read
            # burst; no background polling or warmer.
            self.sleep(1.0)
            guard = {'ConditionCheck': {'TableName':self.table, 'Key':encode({'PK':'CONTROL','SK':'META'}),
                'ConditionExpression':'attribute_not_exists(product_generation) OR product_generation <> :candidate',
                'ExpressionAttributeValues':encode({':candidate':job['generation']})}}
            job_guard = {'ConditionCheck': {'TableName':self.table, 'Key':encode({'PK':job['PK'],'SK':'META'}),
                'ConditionExpression':'generation = :generation AND #state = :preparing',
                'ExpressionAttributeNames':{'#state':'state'},
                'ExpressionAttributeValues':encode({':generation':job['generation'], ':preparing':'PREPARING'})}}
            self.transact([guard, job_guard, *rows[offset:offset + 20]], job['generation'] + '-stage-' + str(offset))

    def activate(self, job):
        old = job['source_control']
        control = {**old, 'PK':'CONTROL','SK':'META', 'revision':int(old['revision']) + 1,
            'product_generation':job['generation'], 'product_revision_fence':job['fence'],
            'last_reset_date':job['day'], 'reset_baseline_version':job['baseline_version']}
        complete = {key:value for key,value in job.items() if key not in ('defaults','tag_updates','source_control')}
        complete.update(state='COMPLETED', product_count=5, committed_control_revision=control['revision'])
        complete.update(SK='META', plan_sha256=self.plan_digest(job))
        complete['previous_generation'] = old.get('product_generation', 'legacy')
        rows = [{'Put': {'TableName':self.table,'Item':encode(control),**control_condition(old)}},
                {'Put': {'TableName':self.table,'Item':encode(complete),
                    'ConditionExpression':'generation = :generation AND #state = :preparing',
                    'ExpressionAttributeNames':{'#state':'state'},
                    'ExpressionAttributeValues':encode({':generation':job['generation'],':preparing':'PREPARING'})}}]
        rows += [{'Put':{'TableName':self.table, 'Item':encode(tag)}} for tag in job['tag_updates']]
        self.transact(rows, job['generation'] + '-activate')
        return complete

    def run(self, event):
        if not isinstance(event, dict) or set(event) != {'scheduled_time'}:
            raise ValueError('Only scheduled_time is accepted')
        now = self.clock()
        day, scheduled = intended_day(event['scheduled_time'], now)
        for attempt in range(MAX_ATTEMPTS):
            control = catalog_control(self.client, self.table)
            if control.get('reset_paused') is True:
                return {'outcome':'SKIPPED_OPERATIONALLY_PAUSED', 'day':day}
            if control.get('reset_blocked_through_date', '') >= day:
                return {'outcome':'SKIPPED_RECOVERY_FENCE', 'day':day}
            if control.get('last_reset_date', '') >= day:
                return {'outcome':'SKIPPED_ALREADY_COMMITTED_OR_OBSOLETE', 'day':day}
            # Late delivery must never wipe the next day's administrator work.
            if now.astimezone(eastern_zone()).date().isoformat() != day or now - scheduled > timedelta(hours=1):
                return {'outcome':'SKIPPED_EXPIRED', 'day':day}
            try:
                job = self.prepare(day, control)
                if job['state'] == 'COMPLETED':
                    return {'outcome':'SKIPPED_ALREADY_COMMITTED', 'day':day}
                self.stage(job)
                # Recheck deadline immediately before activation as staging may be slow.
                current_time = self.clock()
                if current_time - scheduled > timedelta(hours=1):
                    return {'outcome':'SKIPPED_EXPIRED', 'day':day}
                self.activate(job)
                return {'outcome':'COMPLETED', 'day':day, 'generation':job['generation'], 'product_count':5}
            except (ClientError, BotoCoreError, TimeoutError, Conflict):
                # A timeout/cancellation can occur after commit. Read the durable
                # day fence before deciding whether another attempt is safe.
                recovered = catalog_control(self.client, self.table)
                if recovered.get('last_reset_date', '') >= day:
                    audit = self.get('RESET#' + day)
                    if recovered['last_reset_date'] == day and audit and audit.get('state') == 'COMPLETED':
                        return {'outcome':'COMPLETED_RECOVERED', 'day':day}
                    return {'outcome':'SKIPPED_OBSOLETE', 'day':day}
                if attempt == MAX_ATTEMPTS - 1:
                    raise
                self.sleep(min(8, 2 ** attempt) + random.random())
        raise RuntimeError('Reset attempt budget exhausted')


class Conflict(Exception):
    pass


def handler(event, context):
    # No public route and no invocation on deployment. Only the dedicated role
    # can write catalog generations; configuration remains disabled by default.
    try:
        client = boto3.client('dynamodb', region_name='us-east-2', config=Config(
            connect_timeout=1, read_timeout=3, retries={'total_max_attempts':2, 'mode':'standard'}))
        result = ResetWorker(client, os.environ['CATALOG_TABLE']).run(event)
        logger.warning('catalog_reset outcome=%s day=%s request_id=%s', result['outcome'], result['day'], getattr(context,'aws_request_id','unavailable'))
        return result
    except Exception as error:
        logger.error('catalog_reset outcome=FAILED error_type=%s request_id=%s', type(error).__name__, getattr(context,'aws_request_id','unavailable'))
        raise
