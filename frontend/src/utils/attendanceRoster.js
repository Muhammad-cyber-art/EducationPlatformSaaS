export const editableAttendanceStudents = students => (students || []).filter(student => student.can_mark !== false && !student.is_frozen);

export function sameAttendanceRoster(first, second) {
  const ids = students => new Set(editableAttendanceStudents(students).map(student => Number(student.id)));
  const a = ids(first), b = ids(second);
  return a.size === b.size && [...a].every(id => b.has(id));
}

export function offlineAttendanceRoster(students, date) {
  const day = value => value ? new Date(value).toLocaleDateString('sv-SE') : null;
  return (students || []).map(student => {
    const joined = day(student.joined_at), left = day(student.left_at), frozen = day(student.frozen_at);
    const isFrozen = student.is_frozen && (!frozen || date >= frozen);
    return { ...student, is_frozen: Boolean(isFrozen), can_mark: student.is_active !== false && !student.is_archived &&
      (!joined || joined <= date) && (!left || date <= left) && !isFrozen };
  });
}
