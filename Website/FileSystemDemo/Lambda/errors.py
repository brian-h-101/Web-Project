class AppError(Exception):
    def __init__(self, message, status=400, code="validation_error"):
        super().__init__(message)
        self.status, self.code = status, code
