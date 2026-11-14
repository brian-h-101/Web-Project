from http_api import invoke

def handler(event,context):
    return invoke(event,context,management=True)
