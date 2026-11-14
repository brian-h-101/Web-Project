"""Disposable, loopback-only preview. All AWS SDK transport is prohibited."""
import argparse
import base64
import http.client
import json
import os
import subprocess
import socket
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline-preview', action='store_true', required=True)
    parser.add_argument('--port', type=int, default=5190)
    parser.add_argument('--commerce-port', type=int, default=5192)
    parser.add_argument('--public-management',action='store_true',help='Enable the explicit shared policy in disposable Moto only; never contacts AWS.')
    parser.add_argument('--pid-file',type=Path)
    args = parser.parse_args()
    for port in (args.port, args.commerce_port):
        with socket.socket() as check:
            check.bind(('127.0.0.1', port))
    root = Path(__file__).resolve().parents[2]
    assets = root / 'Frontend' / 'dist'
    if not (assets / 'demos/file-system-simulator/index.html').is_file():
        raise SystemExit('Run npm run build first.')
    os.environ.update(AWS_ACCESS_KEY_ID='testing', AWS_SECRET_ACCESS_KEY='testing', AWS_SESSION_TOKEN='testing', AWS_DEFAULT_REGION='us-east-2', AWS_EC2_METADATA_DISABLED='true', CATALOG_MODE='legacy')
    os.environ['PUBLIC_SHARED_MANAGEMENT_ENABLED']='true' if args.public_management else 'false'
    for key in ('AWS_PROFILE', 'AWS_DEFAULT_PROFILE', 'COGNITO_ISSUER', 'COGNITO_CLIENT_ID'):
        os.environ.pop(key, None)
    import boto3
    from moto import mock_aws
    from botocore.httpsession import URLLib3Session
    import http_api
    from repositories.catalog_repository import CatalogRepository
    from repositories.document_storage import DocumentStorage
    from services.file_system_service import FileSystemService
    from services.document_service import DocumentService
    from services.tag_service import TagService
    from seed import apply
    with mock_aws():
        def blocked(*args, **kwargs):
            raise RuntimeError('Live AWS transport is prohibited in offline preview')
        URLLib3Session.send = blocked
        client = boto3.client('dynamodb', region_name='us-east-2')
        for name in ('OfflineCatalog', 'OfflineFileSystem'):
            client.create_table(TableName=name, BillingMode='PAY_PER_REQUEST', KeySchema=[{'AttributeName': 'PK', 'KeyType': 'HASH'}, {'AttributeName': 'SK', 'KeyType': 'RANGE'}], AttributeDefinitions=[{'AttributeName': key, 'AttributeType': 'S'} for key in ('PK', 'SK')])
        s3 = boto3.client('s3', region_name='us-east-2')
        s3.create_bucket(Bucket='offline-document-contents', CreateBucketConfiguration={'LocationConstraint': 'us-east-2'})
        s3.put_bucket_versioning(Bucket='offline-document-contents', VersioningConfiguration={'Status': 'Enabled'})
        db, storage = CatalogRepository(client, 'OfflineCatalog', 'OfflineFileSystem'), DocumentStorage(s3, 'offline-document-contents')
        http_api._database, http_api._storage = db, storage
        apply(db)
        tag = TagService(db).mutate({'name': 'Architecture'})
        guide = TagService(db).mutate({'name': 'Getting started'})
        fs = FileSystemService(db, storage)
        folder = fs.folder({'parentId': 'root', 'name': 'Project notes'})
        fs.mutate(folder['id'], {'expectedRevision': 1, 'status': 'PUBLISHED'})
        samples = [('Welcome.md', 'markdown', '# A workspace for ideas\n\nBrowse curated project notes, search metadata, and explore the shared product catalog.\n\n## How it works\n\n- React renders the virtual filesystem.\n- DynamoDB owns metadata and tag references.\n- Private S3 stores immutable document versions.\n\nThis local preview uses disposable emulators. No AWS account is contacted.', [guide['id']]), ('Storage and indexing.md', 'markdown', '# Storage and indexing\n\nThe metadata index contains names, product descriptions, SKUs and canonical tag references. Document bodies are not indexed.\n\nUpdates use a bounded DynamoDB transaction and revision checks. Unknown commit outcomes retain staged S3 objects for reconciliation.', [tag['id']]), ('Demo checklist.txt', 'text', 'Browse folders\nOpen a document\nFilter by tags\nSearch the product catalog\n\nPublic visitors have read-only access.', [guide['id'], tag['id']])]
        for name, format, content, tags in samples:
            item = DocumentService(db, storage).save({'parentId': folder['id'], 'name': name, 'format': format, 'content': content, 'tag_ids': tags})
            fs.mutate(item['id'], {'expectedRevision': 1, 'status': 'PUBLISHED'})
        child_env = {**os.environ, 'PYTHONPATH': os.pathsep.join([str(root / 'CommerceDemo' / 'Lambda'), str(root)])}
        child = subprocess.Popen([sys.executable, str(root / 'CommerceDemo/Lambda/preview.py'), '--offline-preview', '--port', str(args.commerce_port)], cwd=str(root / 'CommerceDemo/Lambda'), env=child_env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pid_file = args.pid_file or root / 'Infrastructure/.local/filesystem/preview-pids.json'
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text(json.dumps({'parent': os.getpid(), 'commerce': child.pid, 'port': args.port, 'commercePort': args.commerce_port}))
        try:
            ready = False
            for _ in range(40):
                if child.poll() is not None:
                    raise RuntimeError('Owned Commerce preview failed to start; check port availability')
                try:
                    connection = http.client.HTTPConnection('127.0.0.1', args.commerce_port, timeout=1)
                    connection.request('GET', '/api/health')
                    response = connection.getresponse()
                    ready = response.status == 200
                    response.read(); connection.close()
                    if ready: break
                except OSError:
                    pass
                time.sleep(.2)
            if not ready: raise RuntimeError('Owned Commerce preview did not become ready')

            class Preview(SimpleHTTPRequestHandler):
                def __init__(self, *values, **kwargs): super().__init__(*values, directory=str(assets), **kwargs)
                def log_message(self, *unused): pass
                def end_headers(self):
                    self.send_header('X-Frame-Options', 'SAMEORIGIN')
                    self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; frame-src 'self' blob:; frame-ancestors 'self'; connect-src 'self'; object-src 'none'")
                    super().end_headers()
                def api(self):
                    parsed = urlsplit(self.path)
                    length = int(self.headers.get('Content-Length', '0'))
                    if length < 0 or length > 3 * 1024 * 1024:
                        self.send_error(413); return
                    raw = self.rfile.read(length).decode('utf-8') if length else ''
                    if parsed.path.startswith(('/api/catalog/', '/api/filesystem/')):
                        # No synthetic admin identity. Anonymous management uses
                        # the same explicit server policy as production code.
                        result = http_api.invoke({'version': '2.0', 'rawPath': parsed.path, 'rawQueryString': parsed.query, 'requestContext': {'http': {'method': self.command}}, 'headers': dict(self.headers.items()), 'body': raw}, SimpleNamespace(aws_request_id='offline-preview'), '/admin/' in parsed.path, management='/manage/' in parsed.path)
                        body = base64.b64decode(result['body']) if result['isBase64Encoded'] else result['body'].encode()
                        self.send_response(result['statusCode'])
                        for name, value in result['headers'].items(): self.send_header(name, value)
                    else:
                        connection = http.client.HTTPConnection('127.0.0.1', args.commerce_port, timeout=10)
                        connection.request(self.command, self.path, body=raw, headers={name: value for name, value in self.headers.items() if name.lower() not in ('host', 'content-length')})
                        result = connection.getresponse(); body = result.read()
                        self.send_response(result.status)
                        for name, value in result.getheaders():
                            if name.lower() in ('content-type', 'cache-control', 'x-content-type-options'): self.send_header(name, value)
                        connection.close()
                    self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
                def do_GET(self):
                    parsed = urlsplit(self.path)
                    if parsed.path in ('/__preview/desktop', '/__preview/mobile'):
                        width = 1280 if parsed.path.endswith('desktop') else 390
                        content = f'<!doctype html><html><head><title>Offline layout verification</title></head><body><iframe title="{width}px File-System layout" width="{width}" height="1000" src="/demos/file-system-simulator/catalog"></iframe></body></html>'.encode()
                        self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(content))); self.end_headers(); self.wfile.write(content); return
                    if parsed.path.startswith('/api/'): return self.api()
                    if '.' not in parsed.path.rsplit('/', 1)[-1]:
                        self.path = '/demos/file-system-simulator/index.html' if parsed.path == '/demos/file-system-simulator' or parsed.path.startswith('/demos/file-system-simulator/') else '/index.html'
                    super().do_GET()
                do_POST = do_PATCH = do_DELETE = do_PUT = api
            print(f'OFFLINE MOCK PREVIEW: http://127.0.0.1:{args.port}/projects/file-system-simulator (no AWS; shared management {args.public_management})', flush=True)
            ThreadingHTTPServer(('127.0.0.1', args.port), Preview).serve_forever()
        finally:
            child.terminate()
            child.wait(timeout=5)


if __name__ == '__main__':
    main()
