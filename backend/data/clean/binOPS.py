TAX_RATE = 0.1 # Defined as a constant

def calculate_sub_total(price, quantity):
    """Calculates the sub-total price for items."""
    return price * quantity

def calculate_tax_amount(sub_total, tax_rate):
    """Calculates the tax amount based on the sub-total."""
    return sub_total * tax_rate

def display_order_summary(sub_total, tax_amount, total):
    """Prints a summary of the order details."""
    print(f"Sub-total: ${sub_total:.2f}")
    print(f"Tax: ${tax_amount:.2f}")
    print(f"Total: ${total:.2f}")

# Usage
item_price = 20
quantity = 5

sub_total = calculate_sub_total(item_price, quantity)
tax_amount = calculate_tax_amount(sub_total, TAX_RATE)
total_price = sub_total + tax_amount

display_order_summary(sub_total, tax_amount, total_price)