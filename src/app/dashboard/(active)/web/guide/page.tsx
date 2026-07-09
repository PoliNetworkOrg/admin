import { getAllGuides } from "@/server/actions/guides"
import { GuideTable } from "./table"

export default async function GuideMatricolaPage() {
  const guides = await getAllGuides()

  return (
    <div className="container">
      <GuideTable guides={guides} />
    </div>
  )
}
