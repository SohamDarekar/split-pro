import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression check for the Bill Reminders date-picker bug: DateSelector (Radix
 * Popover) rendered inside a vaul Drawer caused iOS taps on a calendar day to
 * land on the Drawer's overlay instead of the day button, so onSelect never
 * fired and the field silently kept showing "Pick a date". The fix was moving
 * Bill Reminders off Drawer entirely onto a full page — this test guards
 * against that nesting quietly coming back (e.g. someone wrapping the create
 * or detail view in a Drawer/Dialog again for "polish").
 *
 * This is a static source check, not a rendered-DOM check — this repo has no
 * React Testing Library / component-render test setup, so this is the
 * feasible option without introducing a new test-infra dependency.
 */
describe('BillReminders: DateSelector must never be nested inside a Drawer', () => {
  it('the Bill Reminders component does not import the Drawer primitive at all', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Account/BillReminders/BillReminders.tsx'),
      'utf8',
    );

    expect(source).toContain('DateSelector');
    expect(source).not.toMatch(/from ['"]~\/components\/ui\/drawer['"]/);
    expect(source).not.toContain('<Drawer');
  });

  it('the Bill Reminders page does not import the Drawer primitive either', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/account/bill-reminders.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/from ['"]~\/components\/ui\/drawer['"]/);
    expect(source).not.toContain('<Drawer');
  });
});
