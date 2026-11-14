"""Explicit anonymous content policy. This never establishes an admin identity."""
import json,os,re
from pathlib import Path
from errors import AppError
CONTRACT=json.loads((Path(__file__).resolve().parents[1]/'content_routes.json').read_text())

def enabled():return os.environ.get('PUBLIC_SHARED_MANAGEMENT_ENABLED','false')=='true'

def configuration():
    return {'version':CONTRACT['version'],'enabled':enabled(),'workspace':'shared-demo-workspace','permissions':CONTRACT['permissions'] if enabled() else []}

def content_route(path,method):
    return any(method==r['method'] and re.fullmatch(re.escape(r['path']).replace(r'\{id\}','[^/]+').replace(r'\{sku\}','[^/]+'),path) for r in CONTRACT['routes'])

def authorize(path,method):
    if not enabled():raise AppError('Shared visitor management is not enabled.',403,'management_disabled')
    match=re.fullmatch(r'/api/(catalog|filesystem)/manage/(.+)',path)
    normalized='/api/'+match[1]+'/'+match[2] if match else ''
    if not content_route(normalized,method):raise AppError('Content route not found.',404,'not_found')
    return normalized
