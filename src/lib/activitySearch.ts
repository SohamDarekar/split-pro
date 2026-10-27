export interface ActivityEntry {
  expense: {
    name: string;
    paidByUser: { name: string | null; email: string | null };
    group?: { name: string } | null;
  };
}

export const searchActivity = <T extends ActivityEntry>(entries: T[], query: string): T[] => {
  const search = query.trim().toLowerCase();

  if ('' === search) {
    return entries;
  }

  return entries.filter(({ expense }) =>
    [expense.name, expense.paidByUser.name, expense.paidByUser.email, expense.group?.name]
      .filter((value): value is string => !!value)
      .some((value) => value.toLowerCase().includes(search)),
  );
};
