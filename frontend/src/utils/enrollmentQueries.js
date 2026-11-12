const membershipQueries = new Set([
  'student', 'students', 'global-students', 'group-detail', 'group-students',
  'groups', 'groups-list', 'nested_groups', 'join-groups', 'attendance-roster',
  'attendance', 'cashier-desk', 'payments-all', 'student-history',
]);

export function invalidateEnrollmentQueries(queryClient) {
  return queryClient.invalidateQueries({ predicate: query => membershipQueries.has(query.queryKey[0]) });
}
