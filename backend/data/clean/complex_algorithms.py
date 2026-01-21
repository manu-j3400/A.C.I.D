import functools
import time
from collections import deque

def quicksort(arr):
    """
    Complex recursion and list comprehension
    """
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

def bfs_traversal(graph, start):
    """
    Graph traversal using deque and set operations
    """
    visited = set()
    queue = deque([start])
    visited.add(start)
    result = []
    
    while queue:
        vertex = queue.popleft()
        result.append(vertex)
        
        for neighbor in graph[vertex]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return result

def timer_decorator(func):
    """
    Higher-order function (decorator)
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        print(f"Executed {func.__name__} in {end_time - start_time} seconds")
        return result
    return wrapper

@timer_decorator
def complex_matrix_mult(A, B):
    """
    Nested loops and mathematical operations
    """
    result = [[0 for _ in range(len(B[0]))] for _ in range(len(A))]
    for i in range(len(A)):
        for j in range(len(B[0])):
            for k in range(len(B)):
                result[i][j] += A[i][k] * B[k][j]
    return result

class ContextManagerExample:
    """
    Class based context manager with magic methods
    """
    def __init__(self, filename):
        self.filename = filename
        
    def __enter__(self):
        self.file = open(self.filename, 'w')
        return self.file
        
    def __exit__(self, exc_type, exc_value, traceback):
        if self.file:
            self.file.close()

def generator_example(n):
    """
    Generator function with yield
    """
    num = 0
    while num < n:
        yield num
        num += 1
