class OrderError(Exception):
    def __init__(self, message, status=400, code="validation_error", details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details or []


class DuplicateSubmission(Exception):
    pass


class ConcurrentTransaction(Exception):
    pass


class ConditionalCancellation(Exception):
    pass
