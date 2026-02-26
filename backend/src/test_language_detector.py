import pytest
from language_detector import detect_language, get_supported_languages

@pytest.mark.parametrize("code,expected_lang", [
    ("def hello_world():\n    print('Hello, world!')", "python"),
    ("public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, world!\");\n    }\n}", "java"),
    ("const hello = () => { console.log('Hello, world!'); };", "javascript"),
    ("interface User {\n    name: string;\n    age: number;\n}", "typescript"),
    ("#include <stdio.h>\nint main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}", "c"),
    ("#include <iostream>\nint main() {\n    std::cout << \"Hello, world!\" << std::endl;\n    return 0;\n}", "cpp"),
    ("using System;\nnamespace HelloWorld {\n    class Program {\n        static void Main() {\n            Console.WriteLine(\"Hello, world!\");\n        }\n    }\n}", "c_sharp"),
    ("package main\nimport \"fmt\"\nfunc main() {\n    fmt.Println(\"Hello, world!\")\n}", "go"),
    ("def hello_world\n    puts 'Hello, world!'\nend", "ruby"),
    ("<?php\necho 'Hello, world!';\n?>", "php"),
])
def test_detect_language_by_content(code, expected_lang):
    detected_lang, confidence = detect_language(code)
    assert detected_lang == expected_lang
    assert confidence > 0.0

@pytest.mark.parametrize("filename,expected_lang", [
    ("main.py", "python"),
    ("Main.java", "java"),
    ("script.js", "javascript"),
    ("component.tsx", "typescript"),
    ("lib.c", "c"),
    ("main.cpp", "cpp"),
    ("program.cs", "c_sharp"),
    ("server.go", "go"),
    ("app.rb", "ruby"),
    ("index.php", "php"),
])
def test_detect_language_by_extension(filename, expected_lang):
    detected_lang, confidence = detect_language("", filename=filename)
    assert detected_lang == expected_lang
    assert confidence == 1.0

def test_extension_precedence():
    code = "<?php echo 'hi'; ?>"
    filename = "test.py"
    detected_lang, confidence = detect_language(code, filename=filename)
    assert detected_lang == "python"
    assert confidence == 1.0

def test_empty_code():
    detected_lang, confidence = detect_language("")
    assert detected_lang == "python"
    assert confidence == 0.0

def test_unknown_language():
    code = "This is some random text that does not match any programming language signature."
    detected_lang, confidence = detect_language(code)
    assert detected_lang == "python"
    assert confidence == 0.0

def test_unsupported_extension():
    # Should fall back to content detection
    code = "import os\ndef hello():\n    pass"
    filename = "test.txt"
    detected_lang, confidence = detect_language(code, filename=filename)
    assert detected_lang == "python"
    assert confidence > 0.0

def test_get_supported_languages():
    langs = get_supported_languages()
    expected_langs = ["python", "java", "javascript", "typescript", "c", "cpp", "c_sharp", "go", "ruby", "php"]
    assert set(langs) == set(expected_langs)
    assert len(langs) == 10
