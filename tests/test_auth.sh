#!/usr/bin/env bash

source "$(dirname "$0")/test_config.sh"

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_code=$5
    local headers=$6
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $status_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name (Expected $expected_code, got $status_code)"
        ((FAILED++))
        return 1
    fi
}

echo "========================================"
echo "Authentication API Tests"
echo "========================================"
echo ""

RANDOM_EMAIL="${TEST_EMAIL_PREFIX}$(date +%s)@${TEST_EMAIL_DOMAIN}"

echo "--- Registration Tests ---"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | grep -o '"email_verification_required":[^,}]*' | cut -d':' -f2 | tr -d ' ')

if echo "$REGISTER_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓${NC} Register with valid data (HTTP 201)"
    ((PASSED++))
    
    if [ "$REGISTER_STATUS" = "true" ]; then
        SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
        PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
        DB_PATH="$PROJECT_ROOT/dev.db"
        
        if [ -f "$DB_PATH" ]; then
            VERIFY_TOKEN=$(python3 <<PYTHON
import sqlite3
import sys
try:
    conn = sqlite3.connect('$DB_PATH')
    cursor = conn.cursor()
    cursor.execute('SELECT verification_token FROM user WHERE email = ?', ('$RANDOM_EMAIL',))
    result = cursor.fetchone()
    conn.close()
    if result and result[0]:
        print(result[0])
except Exception as e:
    sys.exit(1)
PYTHON
)
            
            if [ -n "$VERIFY_TOKEN" ] && [ "$VERIFY_TOKEN" != "None" ] && [ -n "${VERIFY_TOKEN// }" ]; then
                sleep 0.5
                VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/verify-email" \
                    -H "Content-Type: application/json" \
                    -d "{\"token\":\"$VERIFY_TOKEN\"}")
                
                if echo "$VERIFY_RESPONSE" | grep -q '"ok":true'; then
                    echo -e "${GREEN}✓${NC} Email verified for test user"
                    sleep 0.5
                else
                    echo -e "${YELLOW}⚠${NC} Email verification may have failed, but continuing..."
                fi
            fi
        fi
    fi
else
    test_endpoint "Register with valid data" "POST" "/api/v1/auth/register" \
        "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" "201"
fi

test_endpoint "Register duplicate email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" "400"

test_endpoint "Register with short password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"short@test.com\",\"password\":\"123\"}" "422"

test_endpoint "Register without letter in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"noletters@test.com\",\"password\":\"12345678\"}" "422"

test_endpoint "Register without digit in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"nodigits@test.com\",\"password\":\"PasswordOnly\"}" "422"

test_endpoint "Register invalid email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"notanemail\",\"password\":\"$TEST_PASSWORD\"}" "422"

test_endpoint "Register with empty email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"\",\"password\":\"$TEST_PASSWORD\"}" "422"

test_endpoint "Register with empty password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"empty@test.com\",\"password\":\"\"}" "422"

test_endpoint "Register with missing email field" "POST" "/api/v1/auth/register" \
    "{\"password\":\"$TEST_PASSWORD\"}" "422"

test_endpoint "Register with missing password field" "POST" "/api/v1/auth/register" \
    "{\"email\":\"missing@test.com\"}" "422"

echo ""
echo "--- Login Tests ---"
test_endpoint "Login with correct credentials" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" "200"

TOKEN=""
login_attempts=0
max_login_attempts=3

while [ -z "$TOKEN" ] && [ $login_attempts -lt $max_login_attempts ]; do
    login_attempts=$((login_attempts + 1))
    login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    
    TOKEN=$(echo "$login_response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        if [ $login_attempts -lt $max_login_attempts ]; then
            sleep 1
        fi
    fi
done

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠${NC} Failed to obtain authentication token"
    TOKEN="invalid-token-for-testing"
else
    echo -e "${GREEN}✓${NC} Authentication token obtained"
fi

export TOKEN

test_endpoint "Login with wrong password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"WrongPass123\"}" "401"

test_endpoint "Login with non-existent user" "POST" "/api/v1/auth/login" \
    "{\"email\":\"nonexistent@test.com\",\"password\":\"$TEST_PASSWORD\"}" "401"

test_endpoint "Login with empty email" "POST" "/api/v1/auth/login" \
    "{\"email\":\"\",\"password\":\"$TEST_PASSWORD\"}" "422"

test_endpoint "Login with empty password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"\"}" "422"

test_endpoint "Login with missing fields" "POST" "/api/v1/auth/login" \
    "{\"email\":\"test@test.com\"}" "422"

echo ""
echo "--- Change Password Tests ---"
if [ -n "$TOKEN" ] && [ "$TOKEN" != "invalid-token-for-testing" ]; then
    AUTH_HEADER="Authorization: Bearer $TOKEN"
    
    test_endpoint "Change password with correct current password" "POST" "/api/v1/auth/change-password" \
        "{\"current_password\":\"$TEST_PASSWORD\",\"new_password\":\"NewPass123\"}" "200" "$AUTH_HEADER"
    
    test_endpoint "Login with new password" "POST" "/api/v1/auth/login" \
        "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"NewPass123\"}" "200"
    
    NEW_TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"NewPass123\"}" | \
        grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$NEW_TOKEN" ]; then
        TOKEN="$NEW_TOKEN"
        export TOKEN
    fi
    
    test_endpoint "Change password with wrong current password" "POST" "/api/v1/auth/change-password" \
        "{\"current_password\":\"WrongPass123\",\"new_password\":\"AnotherPass123\"}" "400" "$AUTH_HEADER"
    
    test_endpoint "Change password with same password" "POST" "/api/v1/auth/change-password" \
        "{\"current_password\":\"NewPass123\",\"new_password\":\"NewPass123\"}" "400" "$AUTH_HEADER"
fi

echo ""
echo "========================================"
echo "Authentication Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

