import ast

class codeNormalizer(ast.NodeTransformer):

    """
    Normalizes the given AST of the source code

    """

    def __init__(self):
        self.mapping = {}
        self.counter = 0
    
    def get_id(self, original_id):
        if original_id not in self.mapping:
            self.mapping[original_id] = f"VAR_{self.counter}" # creates a generic ID
            self.counter += 1
        return self.mapping[original_id]  # returns new node
    

    def visit_Name(self, node):
        # renames all variables
        node.id = self.get_id(node)
        return node
    
    def visit_arg(self, node):
        node.arg = self.get_id(node.arg)
        return node
