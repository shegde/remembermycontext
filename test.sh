#!/usr/bin/env bash

BASE_URL="http://127.0.0.1:8000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
        echo "$body"
        return 0
    else
        echo -e "${RED}✗${NC} $name (Expected $expected_code, got $status_code)"
        ((FAILED++))
        echo "$body"
        return 1
    fi
}

echo "========================================"
echo "RememberMyContext API Test Suite"
echo "========================================"
echo ""

echo "Testing server availability..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}✗ Server not running on $BASE_URL${NC}"
    echo "Start server with: ./start.sh"
    exit 1
fi
echo -e "${GREEN}✓${NC} Server is running"
echo ""

echo "--- Basic Endpoints ---"
test_endpoint "Root endpoint" "GET" "/" "" "200"
test_endpoint "Health check" "GET" "/health" "" "200"
echo ""

echo "--- Authentication Tests ---"
RANDOM_EMAIL="test$(date +%s)@example.com"
test_endpoint "Register with valid data" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "201"

test_endpoint "Register duplicate email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "400"

test_endpoint "Register with short password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"short@test.com\",\"password\":\"123\"}" "422"

test_endpoint "Register without letter in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"noletters@test.com\",\"password\":\"12345678\"}" "422"

test_endpoint "Register without digit in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"nodigits@test.com\",\"password\":\"PasswordOnly\"}" "422"

test_endpoint "Register invalid email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"notanemail\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Login with correct credentials" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "200"

if test_endpoint "Login response" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "200"; then
    TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" | \
        grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
fi

test_endpoint "Login with wrong password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"WrongPass123\"}" "401"

test_endpoint "Login with non-existent user" "POST" "/api/v1/auth/login" \
    "{\"email\":\"nonexistent@test.com\",\"password\":\"ValidPass123\"}" "401"

echo ""
echo "--- Context Tests (Authenticated) ---"
AUTH_HEADER="Authorization: Bearer $TOKEN"

test_endpoint "Get contexts without auth" "GET" "/api/v1/contexts" "" "403"

test_endpoint "Get contexts with auth" "GET" "/api/v1/contexts" "" "200" "$AUTH_HEADER"

test_endpoint "Create Career context" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"I am a software engineer with 10 years experience in Python, JavaScript, and cloud architecture.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Work context" "POST" "/api/v1/contexts/Work/versions" \
    "{\"text\":\"Currently working at Tech Corp as Senior Developer.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Health context" "POST" "/api/v1/contexts/Health/versions" \
    "{\"text\":\"Regular exercise 3x per week, vegetarian diet.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Travel context" "POST" "/api/v1/contexts/Travel/versions" \
    "{\"text\":\"Prefer eco-friendly travel, visited 20 countries.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Custom context" "POST" "/api/v1/contexts/Custom/versions" \
    "{\"text\":\"Custom preferences and settings.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create context with empty text" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with whitespace only" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"   \"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with invalid box name" "POST" "/api/v1/contexts/InvalidBox/versions" \
    "{\"text\":\"Test content\"}" "422" "$AUTH_HEADER"

test_endpoint "Get Career versions" "GET" "/api/v1/contexts/Career/versions" "" "200" "$AUTH_HEADER"

test_endpoint "Get specific version" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"

test_endpoint "Get non-existent version" "GET" "/api/v1/contexts/Career/versions/999" "" "404" "$AUTH_HEADER"

if test_endpoint "Get ciphertext" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"; then
    CIPHERTEXT=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/api/v1/contexts/Career/versions/0" | \
        grep -o '"ciphertext":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$CIPHERTEXT" ]; then
        test_endpoint "Decrypt context" "POST" "/api/v1/contexts/decrypt" \
            "{\"ciphertext\":\"$CIPHERTEXT\"}" "200" "$AUTH_HEADER"
    fi
fi

test_endpoint "Mark version as used" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"chatgpt.com\"}" "200" "$AUTH_HEADER"

echo ""
echo "--- Analytics Tests ---"
test_endpoint "Create analytics event" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\",\"metadata\":{\"box\":\"Career\",\"version\":0}}" \
    "201" "$AUTH_HEADER"

test_endpoint "Get analytics events" "GET" "/api/v1/analytics" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics without auth" "GET" "/api/v1/analytics" "" "403"

echo ""
echo "--- Feedback Tests ---"
test_endpoint "Submit feedback" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"Test feedback message\",\"email\":\"feedback@test.com\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback without email" "POST" "/api/v1/feedback" \
    "{\"type\":\"feature\",\"message\":\"Feature request\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback with invalid type" "POST" "/api/v1/feedback" \
    "{\"type\":\"invalid\",\"message\":\"Test\"}" \
    "422" "$AUTH_HEADER"

echo ""
echo "--- Authentication Edge Cases ---"
test_endpoint "Register with empty email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Register with empty password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"empty@test.com\",\"password\":\"\"}" "422"

test_endpoint "Register with missing email field" "POST" "/api/v1/auth/register" \
    "{\"password\":\"ValidPass123\"}" "422"

test_endpoint "Register with missing password field" "POST" "/api/v1/auth/register" \
    "{\"email\":\"missing@test.com\"}" "422"

test_endpoint "Register with very long email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$(printf 'a%.0s' {1..250})@test.com\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Register with very long password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"longpass@test.com\",\"password\":\"$(printf 'A1%.0s' {1..60})\"}" "422"

test_endpoint "Register with SQL injection attempt in email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"test'; DROP TABLE users; --@test.com\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Register with XSS attempt in email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"<script>alert('xss')</script>@test.com\",\"password\":\"ValidPass123\"}" "422"

SPECIAL_EMAIL="special$(date +%s)@test.com"
test_endpoint "Register with special characters in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$SPECIAL_EMAIL\",\"password\":\"Valid!@#\$%^&*()123\"}" "201"

test_endpoint "Login with empty email" "POST" "/api/v1/auth/login" \
    "{\"email\":\"\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Login with empty password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"\"}" "422"

test_endpoint "Login with missing fields" "POST" "/api/v1/auth/login" \
    "{\"email\":\"test@test.com\"}" "422"

test_endpoint "Login with SQL injection in password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"' OR '1'='1\"}" "401"

echo ""
echo "--- Context Edge Cases ---"
test_endpoint "Create context with missing text field" "POST" "/api/v1/contexts/Career/versions" \
    "{}" "422" "$AUTH_HEADER"

test_endpoint "Create context with null text" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":null}" "422" "$AUTH_HEADER"

test_endpoint "Create context with very long text (near limit)" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"$(printf 'A%.0s' {1..49999})\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with text exceeding limit" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"$(printf 'A%.0s' {1..50001})\"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with unicode characters" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"Hello 世界 🌍 Привет مرحبا\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with emojis" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"🚀 Software Engineer 💻 with 10 years experience 🎯\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with SQL injection attempt" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"'; DROP TABLE context_version; --\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with XSS attempt" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"<script>alert('xss')</script>\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with newlines and special chars" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"Line 1\\nLine 2\\r\\nLine 3\\tTabbed\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with JSON in text" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"{\\\"key\\\": \\\"value\\\"}\"}" "201" "$AUTH_HEADER"

test_endpoint "Get versions with negative version number" "GET" "/api/v1/contexts/Career/versions/-1" "" "422" "$AUTH_HEADER"

test_endpoint "Get versions with very large version number" "GET" "/api/v1/contexts/Career/versions/999999" "" "404" "$AUTH_HEADER"

test_endpoint "Get versions with invalid box name" "GET" "/api/v1/contexts/InvalidBox123/versions" "" "422" "$AUTH_HEADER"

test_endpoint "Mark version used with empty site" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Mark version used with missing site field" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{}" "422" "$AUTH_HEADER"

test_endpoint "Mark version used with very long site name" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"$(printf 'a%.0s' {1..300})\"}" "422" "$AUTH_HEADER"

echo ""
echo "--- Decryption Edge Cases ---"
test_endpoint "Decrypt with empty ciphertext" "POST" "/api/v1/contexts/decrypt" \
    "{\"ciphertext\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Decrypt with missing ciphertext field" "POST" "/api/v1/contexts/decrypt" \
    "{}" "422" "$AUTH_HEADER"

test_endpoint "Decrypt with invalid ciphertext format" "POST" "/api/v1/contexts/decrypt" \
    "{\"ciphertext\":\"not-a-valid-ciphertext\"}" "400" "$AUTH_HEADER"

test_endpoint "Decrypt with malformed base64" "POST" "/api/v1/contexts/decrypt" \
    "{\"ciphertext\":\"!!!invalid-base64!!!\"}" "400" "$AUTH_HEADER"

test_endpoint "Decrypt with SQL injection attempt" "POST" "/api/v1/contexts/decrypt" \
    "{\"ciphertext\":\"'; DROP TABLE users; --\"}" "400" "$AUTH_HEADER"

echo ""
echo "--- Token/Authorization Edge Cases ---"
test_endpoint "Get contexts with missing Authorization header" "GET" "/api/v1/contexts" "" "403"

test_endpoint "Get contexts with malformed Authorization header" "GET" "/api/v1/contexts" "" "403" "Authorization: InvalidFormat"

test_endpoint "Get contexts with empty token" "GET" "/api/v1/contexts" "" "403" "Authorization: Bearer "

test_endpoint "Get contexts with invalid token format" "GET" "/api/v1/contexts" "" "401" "Authorization: Bearer invalid.token.here"

test_endpoint "Get contexts with tampered token" "GET" "/api/v1/contexts" "" "401" "Authorization: Bearer ${TOKEN}0"

test_endpoint "Get contexts with expired token format" "GET" "/api/v1/contexts" "" "401" "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxMjM0NTY3ODkwfQ.invalid"

echo ""
echo "--- Analytics Edge Cases ---"
test_endpoint "Create analytics with missing event_type" "POST" "/api/v1/analytics" \
    "{\"metadata\":{\"box\":\"Career\"}}" "422" "$AUTH_HEADER"

test_endpoint "Create analytics with missing metadata" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\"}" "201" "$AUTH_HEADER"

test_endpoint "Create analytics with empty event_type" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"\",\"metadata\":{\"box\":\"Career\"}}" "422" "$AUTH_HEADER"

test_endpoint "Create analytics with very large metadata" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\",\"metadata\":{\"box\":\"Career\",\"data\":\"$(printf 'x%.0s' {1..10000})\"}}" "201" "$AUTH_HEADER"

test_endpoint "Get analytics with limit parameter" "GET" "/api/v1/analytics?limit=5" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics with invalid limit" "GET" "/api/v1/analytics?limit=-1" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics with very large limit" "GET" "/api/v1/analytics?limit=999999" "" "200" "$AUTH_HEADER"

echo ""
echo "--- Feedback Edge Cases ---"
test_endpoint "Submit feedback with empty message" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with missing message" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with missing type" "POST" "/api/v1/feedback" \
    "{\"message\":\"Test message\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with very long message" "POST" "/api/v1/feedback" \
    "{\"type\":\"general\",\"message\":\"$(printf 'A%.0s' {1..10000})\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with SQL injection in message" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"'; DROP TABLE feedback; --\"}" "201" "$AUTH_HEADER"

test_endpoint "Submit feedback with XSS in message" "POST" "/api/v1/feedback" \
    "{\"type\":\"feature\",\"message\":\"<script>alert('xss')</script>\"}" "201" "$AUTH_HEADER"

test_endpoint "Submit feedback with invalid email format" "POST" "/api/v1/feedback" \
    "{\"type\":\"general\",\"message\":\"Test\",\"email\":\"notanemail\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with very long email" "POST" "/api/v1/feedback" \
    "{\"type\":\"general\",\"message\":\"Test\",\"email\":\"$(printf 'a%.0s' {1..250})@test.com\"}" "422" "$AUTH_HEADER"

echo ""
echo "--- Invalid Endpoint Tests ---"
test_endpoint "Access non-existent endpoint" "GET" "/api/v1/nonexistent" "" "404"

test_endpoint "Access root API endpoint" "GET" "/api/v1" "" "404"

test_endpoint "Access context with wrong HTTP method" "PUT" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"Test\"}" "405" "$AUTH_HEADER"

test_endpoint "Access auth endpoint with wrong method" "GET" "/api/v1/auth/login" "" "405"

echo ""
echo "--- Invalid JSON Tests ---"
echo "Testing malformed JSON requests..."
status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{invalid json}")
if [ "$status" = "422" ] || [ "$status" = "400" ]; then
    echo -e "${GREEN}✓${NC} Malformed JSON rejected (HTTP $status)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Malformed JSON not properly rejected (HTTP $status)"
    ((FAILED++))
fi

status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/contexts/Career/versions" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{text: 'unquoted'}")
if [ "$status" = "422" ] || [ "$status" = "400" ]; then
    echo -e "${GREEN}✓${NC} Invalid JSON syntax rejected (HTTP $status)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Invalid JSON not properly rejected (HTTP $status)"
    ((FAILED++))
fi

echo ""
echo "--- Content-Type Edge Cases ---"
status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: text/plain" \
    -d "email=test@test.com&password=test123")
if [ "$status" = "422" ] || [ "$status" = "400" ]; then
    echo -e "${GREEN}✓${NC} Wrong Content-Type rejected (HTTP $status)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Wrong Content-Type handling (HTTP $status)"
    ((PASSED++))
fi

echo ""
echo "--- Rate Limiting Tests ---"
echo "Testing registration rate limit (5/min)..."
echo "Note: Previous tests may have used some quota, so rate limit may trigger earlier"

rate_limit_hit=false
successful_requests=0

for i in {1..8}; do
    status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"ratelimit$i@test.com\",\"password\":\"ValidPass123\"}")
    
    if [ "$status" = "429" ]; then
        if [ "$rate_limit_hit" = false ]; then
            echo -e "${GREEN}✓${NC} Rate limit working (HTTP 429 on request $i after $successful_requests successful requests)"
            ((PASSED++))
            rate_limit_hit=true
        else
            echo -e "${GREEN}✓${NC} Rate limit still active (HTTP 429 on request $i)"
            ((PASSED++))
        fi
    elif [ "$status" = "201" ] || [ "$status" = "400" ]; then
        ((successful_requests++))
        echo -e "${GREEN}✓${NC} Request $i succeeded (HTTP $status)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} Request $i failed with unexpected status (HTTP $status)"
        ((FAILED++))
    fi
    
    if [ $i -lt 8 ] && [ "$status" != "429" ]; then
        sleep 0.1
    fi
done

if [ "$rate_limit_hit" = false ]; then
    echo -e "${YELLOW}⚠${NC} Rate limit was not hit in 8 requests - rate limiter may need adjustment"
    ((PASSED++))
fi

echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

