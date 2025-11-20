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
        echo -e "${RED}✗${NC} Cannot run analytics tests without valid token"
        exit 1
    fi
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo "========================================"
echo "Analytics API Tests"
echo "========================================"
echo ""

echo "--- Create Analytics Tests ---"
test_endpoint "Create analytics event" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\",\"metadata\":{\"box\":\"Career\",\"version\":0}}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create analytics with missing metadata" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\"}" "201" "$AUTH_HEADER"

test_endpoint "Create analytics with missing event_type" "POST" "/api/v1/analytics" \
    "{\"metadata\":{\"box\":\"Career\"}}" "422" "$AUTH_HEADER"

test_endpoint "Create analytics with empty event_type" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"\",\"metadata\":{\"box\":\"Career\"}}" "422" "$AUTH_HEADER"

echo ""
echo "--- Get Analytics Tests ---"
test_endpoint "Get analytics events" "GET" "/api/v1/analytics" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics without auth" "GET" "/api/v1/analytics" "" "403"

test_endpoint "Get analytics with limit parameter" "GET" "/api/v1/analytics?limit=5" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics with invalid limit" "GET" "/api/v1/analytics?limit=-1" "" "200" "$AUTH_HEADER"

echo ""
echo "--- Edge Cases ---"
test_endpoint "Create analytics with very large metadata" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\",\"metadata\":{\"box\":\"Career\",\"data\":\"$(printf 'x%.0s' {1..10000})\"}}" "201" "$AUTH_HEADER"

echo ""
echo "========================================"
echo "Analytics Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

