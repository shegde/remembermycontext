#!/usr/bin/env bash

BASE_URL="http://127.0.0.1:8000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
ADMIN_TOKEN=""

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
        echo "$body" | head -n 5
        return 1
    fi
}

echo "========================================"
echo "Admin Panel API Test Suite"
echo "========================================"
echo ""

echo "Step 1: Admin Login"
echo "-------------------"
# Try default credentials first, then check env
ADMIN_USER="${ADMIN_USERNAME:-admin}"
ADMIN_PASS="${ADMIN_PASSWORD:-admin}"
login_response=$(curl -s -X POST "$BASE_URL/api/v1/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}")

if echo "$login_response" | grep -q "access_token"; then
    ADMIN_TOKEN=$(echo "$login_response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓${NC} Admin login successful"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Admin login failed"
    echo "$login_response"
    ((FAILED++))
    exit 1
fi

AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
echo ""

echo "Step 2: Overview Endpoints"
echo "---------------------------"
test_endpoint "Overview KPIs" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Overview Insights" "GET" "/api/v1/admin/analytics/overview/insights?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Growth Timeline" "GET" "/api/v1/admin/analytics/overview/growth-timeline?time_range=30d" "" "200" "$AUTH_HEADER"
test_endpoint "Context Box Distribution" "GET" "/api/v1/admin/analytics/overview/context-box-distribution?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "LLM Distribution" "GET" "/api/v1/admin/analytics/overview/llm-distribution?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "User Lifecycle" "GET" "/api/v1/admin/analytics/overview/user-lifecycle" "" "200" "$AUTH_HEADER"
test_endpoint "Performance Health" "GET" "/api/v1/admin/analytics/overview/performance-health" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 3: Acquisition Endpoints"
echo "------------------------------"
test_endpoint "Acquisition Metrics" "GET" "/api/v1/admin/analytics/acquisition/metrics?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Acquisition Funnel" "GET" "/api/v1/admin/analytics/acquisition/funnel?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Acquisition Growth Timeline" "GET" "/api/v1/admin/analytics/acquisition/growth-timeline?time_range=30d" "" "200" "$AUTH_HEADER"
test_endpoint "Churn Analysis" "GET" "/api/v1/admin/analytics/acquisition/churn" "" "200" "$AUTH_HEADER"
test_endpoint "Signup Patterns" "GET" "/api/v1/admin/analytics/acquisition/signup-patterns?time_range=7d" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 4: Engagement Endpoints"
echo "-----------------------------"
test_endpoint "Engagement Metrics" "GET" "/api/v1/admin/analytics/engagement/metrics?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Copy Activity Timeline" "GET" "/api/v1/admin/analytics/engagement/copy-activity-timeline?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Context Box Usage" "GET" "/api/v1/admin/analytics/engagement/context-box-usage?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Version Stats" "GET" "/api/v1/admin/analytics/engagement/version-stats" "" "200" "$AUTH_HEADER"
test_endpoint "Power Users" "GET" "/api/v1/admin/analytics/engagement/power-users?time_range=7d&limit=5" "" "200" "$AUTH_HEADER"
test_endpoint "Onboarding Funnel" "GET" "/api/v1/admin/analytics/engagement/onboarding-funnel" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 5: Feature Adoption Endpoints"
echo "-----------------------------------"
test_endpoint "Features Metrics" "GET" "/api/v1/admin/analytics/features/metrics?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Adoption Breakdown" "GET" "/api/v1/admin/analytics/features/adoption-breakdown?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Boxes Per User" "GET" "/api/v1/admin/analytics/features/boxes-per-user" "" "200" "$AUTH_HEADER"
test_endpoint "Version Distribution" "GET" "/api/v1/admin/analytics/features/version-distribution" "" "200" "$AUTH_HEADER"
test_endpoint "Box Ratio" "GET" "/api/v1/admin/analytics/features/box-ratio" "" "200" "$AUTH_HEADER"
test_endpoint "Power User Stats" "GET" "/api/v1/admin/analytics/features/power-user-stats?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Adoption Timeline" "GET" "/api/v1/admin/analytics/features/adoption-timeline?time_range=30d" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 6: LLM Integration Endpoints"
echo "----------------------------------"
test_endpoint "LLM Metrics" "GET" "/api/v1/admin/analytics/llm/metrics?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Platform Distribution" "GET" "/api/v1/admin/analytics/llm/platform-distribution?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Copies By Platform" "GET" "/api/v1/admin/analytics/llm/copies-by-platform?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Usage Trends" "GET" "/api/v1/admin/analytics/llm/usage-trends?time_range=30d" "" "200" "$AUTH_HEADER"
test_endpoint "Platform Details" "GET" "/api/v1/admin/analytics/llm/platform-details?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "User Diversity" "GET" "/api/v1/admin/analytics/llm/user-diversity?time_range=30d" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 7: Performance Endpoints"
echo "------------------------------"
test_endpoint "Performance Metrics" "GET" "/api/v1/admin/analytics/performance/metrics?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Retrieval Trends" "GET" "/api/v1/admin/analytics/performance/retrieval-trends?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Percentiles" "GET" "/api/v1/admin/analytics/performance/percentiles?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Performance By Box" "GET" "/api/v1/admin/analytics/performance/by-box?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Performance By LLM" "GET" "/api/v1/admin/analytics/performance/by-llm?time_range=7d" "" "200" "$AUTH_HEADER"
test_endpoint "Slow Operations" "GET" "/api/v1/admin/analytics/performance/slow-operations?time_range=7d" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 8: DB View Endpoints"
echo "--------------------------"
test_endpoint "DB View - Users" "GET" "/api/v1/admin/analytics/dbview/users?page=1&page_size=10" "" "200" "$AUTH_HEADER"
test_endpoint "DB View - Contexts" "GET" "/api/v1/admin/analytics/dbview/contexts?page=1&page_size=10" "" "200" "$AUTH_HEADER"
test_endpoint "DB View - Feedbacks" "GET" "/api/v1/admin/analytics/dbview/feedbacks?page=1&page_size=10" "" "200" "$AUTH_HEADER"
test_endpoint "DB View - Upgrades" "GET" "/api/v1/admin/analytics/dbview/upgrades?page=1&page_size=10" "" "200" "$AUTH_HEADER"
test_endpoint "DB View - Analytics" "GET" "/api/v1/admin/analytics/dbview/analytics?page=1&page_size=10" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 9: Time Range Variations"
echo "------------------------------"
test_endpoint "24h Time Range" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=24h" "" "200" "$AUTH_HEADER"
test_endpoint "30d Time Range" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=30d" "" "200" "$AUTH_HEADER"
test_endpoint "90d Time Range" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=90d" "" "200" "$AUTH_HEADER"
test_endpoint "All Time Range" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=all_time" "" "200" "$AUTH_HEADER"
echo ""

echo "Step 10: Error Handling"
echo "-----------------------"
test_endpoint "Invalid Time Range" "GET" "/api/v1/admin/analytics/overview/kpis?time_range=invalid" "" "200" "$AUTH_HEADER"
test_endpoint "Unauthorized Access" "GET" "/api/v1/admin/analytics/overview/kpis" "" "403" ""
test_endpoint "Invalid Table Name" "GET" "/api/v1/admin/analytics/dbview/invalid?page=1" "" "404" "$AUTH_HEADER"
echo ""

echo "========================================"
echo "Test Results"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi

