import asyncio
import aiohttp
import json
import os

BASE_URL = "http://localhost:8005"
TEST_FILE_PATH = "test_document.txt"
TEST_UNALLOWED_FILE_PATH = "test_script.exe"

async def test_api():
    print("Starting AskMyDocs API Tests...")
    print("-" * 40)
    
    async with aiohttp.ClientSession() as session:
        # TEST CASE 1.1: Valid Login
        print("Test 1.1: Testing valid login (admin/password123)")
        data = {"username": "admin", "password": "password123"}
        async with session.post(f"{BASE_URL}/auth/login", data=data) as response:
            assert response.status == 200, f"Login failed: {response.status}"
            result = await response.json()
            token = result.get("access_token")
            assert token, "No access token received"
            print("[PASSED] Test 1.1: Valid Login successful")
            
        # TEST CASE 1.2: Invalid Login
        print("Test 1.2: Testing invalid login (wrong/creds)")
        data = {"username": "admin", "password": "wrongpassword"}
        async with session.post(f"{BASE_URL}/auth/login", data=data) as response:
            assert response.status == 401, f"Expected 401, got {response.status}"
            print("[PASSED] Test 1.2: Invalid Login rejected correctly")

        headers = {"Authorization": f"Bearer {token}"}

        # TEST CASE 2.1: Valid Upload
        print("Test 2.1: Testing valid file upload (.txt)")
        # Create a dummy text file
        with open(TEST_FILE_PATH, "w", encoding="utf-8") as f:
            f.write("This is a test document containing secret information about Project X: The project launched in 2024 and aims to revolutionize AI.")
            
        with open(TEST_FILE_PATH, "rb") as f:
            form_data = aiohttp.FormData()
            form_data.add_field("file", f, filename=TEST_FILE_PATH, content_type="text/plain")
            async with session.post(f"{BASE_URL}/upload/", data=form_data, headers=headers) as response:
                assert response.status == 200, f"Upload failed: {response.status}"
                result = await response.json()
                assert "num_chunks" in result, "No chunks returned"
                print(f"[PASSED] Test 2.1: Valid file uploaded and processed ({result['num_chunks']} chunks)")

        # TEST CASE 2.2: Invalid Upload
        print("Test 2.2: Testing invalid file upload (.exe)")
        with open(TEST_UNALLOWED_FILE_PATH, "w") as f:
            f.write("mock exe")
            
        with open(TEST_UNALLOWED_FILE_PATH, "rb") as f:
            form_data = aiohttp.FormData()
            form_data.add_field("file", f, filename=TEST_UNALLOWED_FILE_PATH, content_type="application/x-msdownload")
            async with session.post(f"{BASE_URL}/upload/", data=form_data, headers=headers) as response:
                assert response.status == 400, f"Expected 400, got {response.status}"
                print("[PASSED] Test 2.2: Invalid file extension rejected correctly")

        # TEST CASE 3.1: Valid Chat (with token)
        print("Test 3.1: Testing chat endpoint with valid token")
        chat_data = {"question": "What is Project X?"}
        async with session.post(f"{BASE_URL}/chat/", json=chat_data, headers=headers) as response:
            assert response.status == 200, f"Chat failed: {response.status}"
            print("[PASSED] Test 3.1: Chat stream initiated")
            # We don't need to read the full stream here, just verify 200 OK.
        
        # TEST CASE 3.2: Invalid Chat (no token)
        print("Test 3.2: Testing chat endpoint without token")
        async with session.post(f"{BASE_URL}/chat/", json=chat_data) as response:
            assert response.status == 401, f"Expected 401, got {response.status}"
            print("[PASSED] Test 3.2: Unauthorized chat rejected correctly")
            
    # Cleanup
    if os.path.exists(TEST_FILE_PATH):
        os.remove(TEST_FILE_PATH)
    if os.path.exists(TEST_UNALLOWED_FILE_PATH):
        os.remove(TEST_UNALLOWED_FILE_PATH)

    print("-" * 40)
    print("All tests passed successfully! [SUCCESS]")

if __name__ == "__main__":
    asyncio.run(test_api())
