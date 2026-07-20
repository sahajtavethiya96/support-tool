import { getCustomFields } from "@/lib/custom-fields";
import { CustomFieldsManager } from "./_components/custom-fields-manager";

export const metadata = { title: "Custom Fields" };

export default async function CustomFieldsPage() {
  const fields = await getCustomFields();

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <CustomFieldsManager initialFields={fields} />
    </div>
  );
}
