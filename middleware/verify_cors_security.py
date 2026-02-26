import os
import sys
import re

def test_app_py_content():
    app_py_path = os.path.join(os.path.dirname(__file__), 'app.py')
    with open(app_py_path, 'r') as f:
        content = f.read()

    all_passed = True

    # Check 1: Global CORS configuration
    print("Checking global CORS configuration...")
    if "CORS(app, resources={r\"/*\": {'origins': allowed_origins}})" in content:
        print("  ✅ Secure global CORS configuration found.")
    else:
        print("  ❌ Secure global CORS configuration NOT found.")
        all_passed = False

    # Check 2: allowed_origins definition
    if "allowed_origins = [origin.strip() for origin in allowed_origins_env.split(',') if origin.strip()]" in content:
        print("  ✅ allowed_origins logic found.")
    else:
        print("  ❌ allowed_origins logic NOT found.")
        all_passed = False

    # Check 3: Search for any remaining '*' origins
    print("\nSearching for insecure '*' origins...")
    insecure_origins = re.findall(r"['\"]origins['\"]\s*:\s*['\"][*]['\"]", content)
    insecure_origins += re.findall(r"Access-Control-Allow-Origin['\"]\s*\]\s*=\s*['\"][*]['\"]", content)

    if not insecure_origins:
        print("  ✅ No insecure '*' origins found.")
    else:
        print(f"  ❌ Found {len(insecure_origins)} insecure '*' origins!")
        for match in insecure_origins:
            print(f"     Match: {match}")
        all_passed = False

    if all_passed:
        print("\n🚀 ALL STATIC SECURITY CHECKS PASSED!")
        sys.exit(0)
    else:
        print("\n❌ SOME STATIC SECURITY CHECKS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    test_app_py_content()
