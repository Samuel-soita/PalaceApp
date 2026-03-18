#!/bin/bash

# Configuration
API_URL="http://localhost:4000"

# Role Membership Numbers from seed
BISHOP_CARD="001/001/2026"
SEC_CARD="003/001/2026"
ADMIN_CARD="005/001/2026"
PASTOR_CARD="101/001/2026"
LEADER_CARD="201/001/2026"
MEMBER_CARD="302/001/2026"

echo "🔓 Authenticating roles..."

get_token() {
    local res=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"membershipNumber\": \"$1\"}")
    local token=$(echo "$res" | grep -oP '"token":"\K[^"]+')
    echo "$token"
}

BISHOP_TOKEN=$(get_token "$BISHOP_CARD")
ADMIN_TOKEN=$(get_token "$ADMIN_CARD")
PASTOR_TOKEN=$(get_token "$PASTOR_CARD")
LEADER_TOKEN=$(get_token "$LEADER_CARD")
MEMBER_TOKEN=$(get_token "$MEMBER_CARD")
WATUA_TOKEN=$(curl -s -X POST "$API_URL/auth/watua-access" | grep -oP '"token":"\K[^"]+')

echo "✅ Auth complete."

echo "🔍 Discovering IDs..."
DISCOVERY=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({ where: { role: 'MEMBER' } });
    const dept = await prisma.department.findFirst();
    const child = await prisma.child.findFirst();
    const bap = await prisma.baptism.findFirst();
    console.log(JSON.stringify({ 
        userId: user?.id, deptId: dept?.id, childId: child?.id, bapId: bap?.id
    }));
}
main().catch(console.error).finally(() => prisma.\$disconnect());
")

USER_ID=$(echo $DISCOVERY | grep -oP '"userId":"\K[^"]+')
DEPT_ID=$(echo $DISCOVERY | grep -oP '"deptId":"\K[^"]+')
CHILD_ID=$(echo $DISCOVERY | grep -oP '"childId":"\K[^"]+')
BAP_ID=$(echo $DISCOVERY | grep -oP '"bapId":"\K[^"]+')

test_route() {
    local method=$1; local path=$2; local token=$3; local role_name=$4
    echo -n "[$role_name] $method $path... "
    local status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_URL$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json")
    if [[ "$status" =~ ^2 ]]; then echo -e "\e[32m$status OK\e[0m"; else echo -e "\e[31m$status\e[0m"; fi
}

echo "📊 --- CORE AUDIT ---"
test_route "GET" "/auth/profile" "$MEMBER_TOKEN" "MEMBER"
test_route "GET" "/departments/tally" "$ADMIN_TOKEN" "ADMIN"
test_route "GET" "/users/pending" "$BISHOP_TOKEN" "BISHOP"
test_route "GET" "/notifications/user/$USER_ID" "$MEMBER_TOKEN" "MEMBER"
test_route "GET" "/children/all" "$ADMIN_TOKEN" "ADMIN"

echo "🌊 --- WORKFLOW AUDIT ---"
test_route "GET" "/workflows/baptism" "$PASTOR_TOKEN" "PASTOR"
test_route "POST" "/workflows/baptism" "$MEMBER_TOKEN" "MEMBER"
test_route "PATCH" "/workflows/baptism/$BAP_ID/status" "$BISHOP_TOKEN" "BISHOP"
test_route "PATCH" "/workflows/dedication/$CHILD_ID/status" "$ADMIN_TOKEN" "ADMIN"

echo "⚡ --- GHOST ACCESS ---"
test_route "GET" "/users/technical/diagnostics" "$WATUA_TOKEN" "WATUA"
test_route "GET" "/users/technical/stats" "$WATUA_TOKEN" "WATUA"

echo "🏁 AUDIT COMPLETE."
