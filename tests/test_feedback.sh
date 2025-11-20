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
        echo -e "${RED}✗${NC} Cannot run feedback tests without valid token"
        exit 1
    fi
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo "========================================"
echo "Feedback API Tests"
echo "========================================"
echo ""

echo "--- Submit Feedback Tests ---"
test_endpoint "Submit feedback" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"Test feedback message\",\"email\":\"feedback@test.com\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback without email" "POST" "/api/v1/feedback" \
    "{\"type\":\"feature\",\"message\":\"Feature request\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback with invalid type" "POST" "/api/v1/feedback" \
    "{\"type\":\"invalid\",\"message\":\"Test\"}" \
    "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with empty message" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with missing message" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with missing type" "POST" "/api/v1/feedback" \
    "{\"message\":\"Test message\"}" "422" "$AUTH_HEADER"

test_endpoint "Submit feedback with invalid email format" "POST" "/api/v1/feedback" \
    "{\"type\":\"general\",\"message\":\"Test\",\"email\":\"notanemail\"}" "422" "$AUTH_HEADER"

echo ""
echo "========================================"
echo "Feedback Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

