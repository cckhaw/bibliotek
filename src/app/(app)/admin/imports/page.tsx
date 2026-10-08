import { requirePage } from "@/lib/auth/session";
import { CsvUpload } from "@/components/CsvUpload";

export const metadata = { title: "Imports" };

export default async function Imports() {
  await requirePage("catalog:import");
  return (
    <>
      <h1 className="h1">Bulk import</h1>
      <p className="muted">Use <b>Validate</b> first: it checks every row and lists problems by line number without saving anything. Import saves all valid rows; rejected rows can be fixed and re-uploaded on their own. Imports respect your license limits.</p>
      <CsvUpload title="Books" endpoint="/api/catalog/import" templateHref="/templates/books.csv"
        columns="title*, author*, category*, branch_code*, isbn, publisher, dewey_code, lc_code, genre, subject, tags (a;b;c), description, copies, barcode" />
      <CsvUpload title="Students" endpoint="/api/students/import" templateHref="/templates/students.csv"
        columns="student_id*, email*, full_name*, department (or grade), phone, student_type" />
    </>
  );
}
