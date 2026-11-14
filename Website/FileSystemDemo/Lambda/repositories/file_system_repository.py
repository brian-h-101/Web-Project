from errors import AppError
from validators import MAX_NODES


class FileSystemRepository:
    def __init__(self, database):
        self.database = database

    def all_nodes(self):
        nodes, incomplete = self.database.query(self.database.filesystem, "NODES", MAX_NODES + 1)
        if incomplete or len(nodes) > MAX_NODES:
            raise AppError("The workspace exceeds its verified node bound.", 503, "workspace_limit")
        if any(item.get('id') != item.get('SK') or item.get('PK') != 'NODES' for item in nodes):
            raise RuntimeError('Unverified canonical node identity')
        return {item["id"]: item for item in nodes}
