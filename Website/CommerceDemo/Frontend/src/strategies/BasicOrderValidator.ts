import type {
  CreateOrderRequest,
  IOrderValidationStrategy,
  Product,
  ValidationIssue,
  ValidationResult,
} from "../types/order";

export class BasicOrderValidator implements IOrderValidationStrategy {
  validate(request: CreateOrderRequest, products: Product[]): ValidationResult {
    const errors: ValidationIssue[] = [];
    const email = request.customer_email.trim().toLowerCase();
    if (email.length > 255 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.(com|org|net)$/.test(email)) {
      errors.push({
        field: "customer_email",
        message: "Use a sample email at example.com, example.org or example.net.",
      });
    }
    if (!request.items.length || request.items.length > 20) {
      errors.push({
        field: "items",
        message: "Add between 1 and 20 order items.",
      });
    }
    const quantities = new Map<string, number>();
    request.items.forEach((item, index) => {
      const sku = item.product_sku.trim().toUpperCase();
      if (!products.some((p) => p.sku === sku))
        errors.push({
          field: `items.${index}.product_sku`,
          message: "Select a product from the catalog.",
        });
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        errors.push({
          field: `items.${index}.quantity`,
          message: "Quantity must be a whole number between 1 and 99.",
        });
      }
      quantities.set(sku, (quantities.get(sku) ?? 0) + item.quantity);
    });
    if ([...quantities.values()].some((q) => q > 99))
      errors.push({
        field: "items",
        message: "The combined quantity for each product cannot exceed 99.",
      });
    return { valid: errors.length === 0, errors };
  }
}
