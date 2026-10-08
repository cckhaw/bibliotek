import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { Workbench } from "@/components/Workbench";
import { Empty } from "@/components/ui";

export const metadata = { title: "Workbench" };

export default async function LibrarianHome() {
  const user = await requirePage("circulation:process");
  const branches = await withTenant(user.tenantId!, async (tx) => {
    const [all, shift] = await Promise.all([
      tx.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      tx.dutyShift.findFirst({ where: { librarianId: user.id, publishedAt: { not: null }, startTime: { lte: new Date() }, endTime: { gte: new Date() } }, select: { branchId: true } }),
    ]);
    return { all, onDuty: shift?.branchId };
  });
  if (branches.all.length === 0) return <Empty>No branches yet. Ask a school admin to add one.</Empty>;
  return (
    <>
      <h1 className="h1">Circulation desk</h1>
      <Workbench branches={branches.all} defaultBranchId={branches.onDuty ?? branches.all[0].id} />
    </>
  );
}
