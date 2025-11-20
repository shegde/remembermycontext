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

if [ -z "$TOKEN" ]; then
    source "$(dirname "$0")/test_auth.sh" > /dev/null 2>&1
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "invalid-token-for-testing" ]; then
        echo -e "${RED}✗${NC} Cannot run context tests without valid token"
        exit 1
    fi
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo "========================================"
echo "Context API Tests"
echo "========================================"
echo ""

echo "--- Basic Context Tests ---"
test_endpoint "Get contexts without auth" "GET" "/api/v1/contexts" "" "403"

test_endpoint "Get contexts with auth" "GET" "/api/v1/contexts" "" "200" "$AUTH_HEADER"

echo ""
echo "--- Create Context Tests ---"
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

test_endpoint "Create context with missing text field" "POST" "/api/v1/contexts/Career/versions" \
    "{}" "422" "$AUTH_HEADER"

echo ""
echo "--- Get Versions Tests ---"
test_endpoint "Get Career versions" "GET" "/api/v1/contexts/Career/versions" "" "200" "$AUTH_HEADER"

test_endpoint "Get specific version" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"

test_endpoint "Get non-existent version" "GET" "/api/v1/contexts/Career/versions/999" "" "404" "$AUTH_HEADER"

test_endpoint "Get versions with negative version number" "GET" "/api/v1/contexts/Career/versions/-1" "" "422" "$AUTH_HEADER"

test_endpoint "Get versions with invalid box name" "GET" "/api/v1/contexts/InvalidBox123/versions" "" "422" "$AUTH_HEADER"

echo ""
echo "--- Decrypt Tests ---"
if test_endpoint "Get ciphertext" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"; then
    CIPHERTEXT=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/api/v1/contexts/Career/versions/0" | \
        grep -o '"ciphertext":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$CIPHERTEXT" ]; then
        test_endpoint "Decrypt context" "POST" "/api/v1/contexts/decrypt" \
            "{\"ciphertext\":\"$CIPHERTEXT\"}" "200" "$AUTH_HEADER"
        
        test_endpoint "Decrypt with empty ciphertext" "POST" "/api/v1/contexts/decrypt" \
            "{\"ciphertext\":\"\"}" "422" "$AUTH_HEADER"
        
        test_endpoint "Decrypt with missing ciphertext field" "POST" "/api/v1/contexts/decrypt" \
            "{}" "422" "$AUTH_HEADER"
        
        test_endpoint "Decrypt with invalid ciphertext format" "POST" "/api/v1/contexts/decrypt" \
            "{\"ciphertext\":\"not-a-valid-ciphertext\"}" "400" "$AUTH_HEADER"
    fi
fi

echo ""
echo "--- Mark Used Tests ---"
test_endpoint "Mark version as used" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"chatgpt.com\"}" "200" "$AUTH_HEADER"

test_endpoint "Mark version used with empty site" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Mark version used with missing site field" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{}" "422" "$AUTH_HEADER"

echo ""
echo "--- Edge Cases ---"
test_endpoint "Create context with very long text (near limit)" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"$(printf 'A%.0s' {1..49999})\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with text exceeding limit" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"$(printf 'A%.0s' {1..50001})\"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with unicode characters" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"Hello 世界 🌍 Привет مرحبا\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with emojis" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"🚀 Software Engineer 💻 with 10 years experience 🎯\"}" "201" "$AUTH_HEADER"

test_endpoint "Create context with newlines and special chars" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"Line 1\\nLine 2\\r\\nLine 3\\tTabbed\"}" "201" "$AUTH_HEADER"

echo ""
echo "========================================"
echo "Context Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

