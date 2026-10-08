import { env } from "../env";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTime = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export const dueSoon = (p: { name: string; title: string; dueDate: Date; school: string }) => ({
  subject: `Reminder: "${p.title}" is due ${fmtDate(p.dueDate)}`,
  body: `Hi ${p.name},\n\n"${p.title}" from ${p.school} is due on ${fmtDate(p.dueDate)}.\nReturn it to any branch of the library, or request an extension from your Bibliotek account.\n`,
});

export const overdue = (p: { name: string; title: string; dueDate: Date; daysLate: number; school: string }) => ({
  subject: `Overdue: "${p.title}" (${p.daysLate} day${p.daysLate === 1 ? "" : "s"} late)`,
  body: `Hi ${p.name},\n\n"${p.title}" was due on ${fmtDate(p.dueDate)} and is now ${p.daysLate} day(s) overdue. Late fines may be accruing.\nPlease return it to any ${p.school} library branch as soon as possible.\n`,
});

export const invite = (p: { name: string; school: string; token: string }) => ({
  subject: `Set up your ${p.school} library account`,
  body: `Hi ${p.name},\n\nAn account has been created for you at ${p.school}'s library. Choose a password here (valid for 7 days):\n\n${env().APP_URL}/set-password?token=${p.token}\n`,
});

export const shiftsPublished = (p: { name: string; shifts: { start: Date; end: Date; branch: string }[] }) => ({
  subject: `New duty roster: ${p.shifts.length} shift${p.shifts.length === 1 ? "" : "s"} published`,
  body: `Hi ${p.name},\n\nYou have been rostered on:\n\n${p.shifts.map((s) => `- ${s.branch}: ${fmtTime(s.start)} -> ${fmtTime(s.end)}`).join("\n")}\n`,
});

export const shiftChanged = (p: { name: string; branch: string; start: Date; end: Date; cancelled?: boolean }) => ({
  subject: p.cancelled ? "Duty shift cancelled" : "Duty shift updated",
  body: p.cancelled
    ? `Hi ${p.name},\n\nYour shift at ${p.branch} on ${fmtTime(p.start)} has been cancelled.\n`
    : `Hi ${p.name},\n\nYour shift has changed. It is now:\n\n- ${p.branch}: ${fmtTime(p.start)} -> ${fmtTime(p.end)}\n`,
});

export const resetOtp = (p: { name: string; code: string; minutes: number }) => ({
  subject: `${p.code} is your Bibliotek verification code`,
  body: `Hi ${p.name},\n\nYour verification code to reset your password is:\n\n    ${p.code}\n\nIt expires in ${p.minutes} minutes and can be used once. If you did not ask to reset your password, you can ignore this email; your password has not changed.\n`,
});
