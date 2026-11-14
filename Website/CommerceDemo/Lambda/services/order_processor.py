from errors import OrderError


class OrderProcessor:
    TRANSITIONS = {"PENDING": {"CONFIRMED", "FAILED"}, "CONFIRMED": {"CANCELLED"}}

    @classmethod
    def transition(cls, order, status, failure_reason=None):
        if status not in cls.TRANSITIONS.get(order["status"], set()):
            raise OrderError(f"Cannot change an order from {order['status']} to {status}.", 409, "invalid_transition")
        order["status"] = status
        order["failure_reason"] = failure_reason

    def process(self, order, simulate_failure):
        self.transition(order, "FAILED" if simulate_failure else "CONFIRMED", "Processing failure requested by the demonstration option." if simulate_failure else None)
