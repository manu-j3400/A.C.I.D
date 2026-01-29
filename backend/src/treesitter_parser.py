"""
Tree-sitter Multi-Language Parser
Provides unified AST parsing across multiple programming languages.
"""

import tree_sitter_python
import tree_sitter_java
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_c
import tree_sitter_cpp
import tree_sitter_c_sharp
import tree_sitter_go
import tree_sitter_ruby
import tree_sitter_php
from tree_sitter import Language, Parser
from collections import Counter
from typing import Dict, Optional


# Initialize parsers for each language
PARSERS = {}
LANGUAGES = {}

def _init_parsers():
    """Initialize tree-sitter parsers for all supported languages."""
    global PARSERS, LANGUAGES
    
    # Standard modules with .language() function
    standard_modules = {
        'python': tree_sitter_python,
        'java': tree_sitter_java,
        'javascript': tree_sitter_javascript,
        'c': tree_sitter_c,
        'cpp': tree_sitter_cpp,
        'c_sharp': tree_sitter_c_sharp,
        'go': tree_sitter_go,
        'ruby': tree_sitter_ruby,
    }
    
    for lang_name, module in standard_modules.items():
        try:
            lang = Language(module.language())
            LANGUAGES[lang_name] = lang
            parser = Parser(lang)
            PARSERS[lang_name] = parser
        except Exception as e:
            print(f"Warning: Failed to initialize {lang_name} parser: {e}")
    
    # TypeScript has separate tsx and typescript
    try:
        ts_lang = Language(tree_sitter_typescript.language_typescript())
        LANGUAGES['typescript'] = ts_lang
        PARSERS['typescript'] = Parser(ts_lang)
    except Exception as e:
        print(f"Warning: Failed to initialize typescript parser: {e}")
    
    # PHP has language_php()
    try:
        php_lang = Language(tree_sitter_php.language_php())
        LANGUAGES['php'] = php_lang
        PARSERS['php'] = Parser(php_lang)
    except Exception as e:
        print(f"Warning: Failed to initialize php parser: {e}")

# Initialize on module load
_init_parsers()


def parse_code(code: str, language: str) -> Optional[object]:
    """
    Parse code using tree-sitter and return the syntax tree.
    
    Args:
        code: Source code string
        language: Language name (python, java, javascript, etc.)
    
    Returns:
        tree-sitter Tree object or None if parsing fails
    """
    if language not in PARSERS:
        raise ValueError(f"Unsupported language: {language}. Supported: {list(PARSERS.keys())}")
    
    parser = PARSERS[language]
    
    try:
        tree = parser.parse(bytes(code, 'utf-8'))
        return tree
    except Exception as e:
        print(f"Parse error for {language}: {e}")
        return None


def get_node_counts(code: str, language: str) -> Dict[str, int]:
    """
    Parse code and count occurrences of each AST node type.
    
    Args:
        code: Source code string
        language: Language name
    
    Returns:
        Dictionary mapping node type names to counts
    """
    tree = parse_code(code, language)
    
    if tree is None:
        return {}
    
    node_counts = Counter()
    
    def walk_tree(node):
        node_counts[node.type] += 1
        for child in node.children:
            walk_tree(child)
    
    walk_tree(tree.root_node)
    
    return dict(node_counts)


def get_normalized_features(code: str, language: str) -> Dict[str, int]:
    """
    Get normalized AST features that are comparable across languages.
    Maps language-specific node types to common categories.
    
    Args:
        code: Source code string
        language: Language name
    
    Returns:
        Dictionary of normalized feature counts
    """
    raw_counts = get_node_counts(code, language)
    
    # Common node type mappings across languages
    COMMON_MAPPINGS = {
        # Function definitions
        'function_definition': ['function_definition', 'method_declaration', 'function_declaration', 
                                'arrow_function', 'method_definition', 'func_literal'],
        # Class definitions  
        'class_definition': ['class_definition', 'class_declaration', 'class_body'],
        # Variable declarations
        'variable_declaration': ['assignment', 'variable_declaration', 'variable_declarator',
                                 'local_variable_declaration', 'short_var_declaration'],
        # Function calls
        'call_expression': ['call', 'call_expression', 'method_invocation', 'function_call_expression'],
        # String literals
        'string_literal': ['string', 'string_literal', 'interpreted_string_literal', 'template_string'],
        # Imports
        'import_statement': ['import_statement', 'import_declaration', 'using_directive', 'require'],
        # Conditionals
        'if_statement': ['if_statement', 'if_expression', 'conditional_expression'],
        # Loops
        'loop_statement': ['for_statement', 'while_statement', 'for_in_statement', 'for_each_statement',
                          'range_clause', 'enhanced_for_statement'],
        # Binary expressions
        'binary_expression': ['binary_expression', 'binary_operator', 'comparison_operator'],
        # Try/catch
        'exception_handling': ['try_statement', 'catch_clause', 'except_clause', 'rescue'],
    }
    
    normalized = {}
    
    # Add raw counts with language prefix
    for node_type, count in raw_counts.items():
        normalized[f"{language}_{node_type}"] = count
    
    # Add normalized common categories
    for common_name, node_types in COMMON_MAPPINGS.items():
        total = sum(raw_counts.get(nt, 0) for nt in node_types)
        normalized[f"common_{common_name}"] = total
    
    # Add language indicator
    normalized[f"is_{language}"] = 1
    
    return normalized


def get_supported_languages() -> list:
    """Return list of supported languages."""
    return list(PARSERS.keys())


if __name__ == "__main__":
    # Test the parser
    test_code = {
        'python': 'def hello():\n    print("Hello, World!")',
        'java': 'public class Main { public static void main(String[] args) { System.out.println("Hi"); } }',
        'javascript': 'const greet = (name) => console.log(`Hello, ${name}!`);',
        'go': 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("Hello") }',
    }
    
    for lang, code in test_code.items():
        print(f"\n--- {lang.upper()} ---")
        counts = get_node_counts(code, lang)
        print(f"Total node types: {len(counts)}")
        print(f"Top 5: {dict(Counter(counts).most_common(5))}")
