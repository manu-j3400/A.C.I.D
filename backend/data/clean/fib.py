def fibonacci_series(n_terms):
    """Prints the Fibonacci series up to n_terms."""
    a, b = 0, 1  # Initialize the first two Fibonacci numbers
    if n_terms <= 0:
        print("Please enter a positive integer.")
        return
    elif n_terms == 1:
        print(f"Fibonacci series: {a}")
        return
    else:
        print(f"Fibonacci series for {n_terms} terms:", end=" ")
        # Iterate n_terms times
        for _ in range(n_terms):
            print(a, end=" ")
            # Update a and b to the next values in the sequence
            a, b = b, a + b
        print() # for a newline at the end