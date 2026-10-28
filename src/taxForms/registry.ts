
import { FEDERAL_FORMS, FederalTaxForm } from "./federalForms";

export interface FormView {
  id: string;
  formNumber: string;
  title: string;
  group: string;
  preparation: string;
  description: string;
}

export interface LibraryCatalog {
  forms: FormView[];
  groups: { id: string; name: string }[];
}

export function formView(form?: FederalTaxForm): FormView | null {
  if (!form) return null;
  return {
    id: form.id,
    formNumber: form.formNumber,
    title: form.title,
    group: form.group,
    preparation: form.preparation,
    description: form.description
  };
}

export function libraryCatalog(): LibraryCatalog {
  return {
    forms: FEDERAL_FORMS.map(f => formView(f)!),
    groups: [
      { id: "federal-core", name: "Federal Core Return Packages" },
      { id: "federal-schedules", name: "Federal Supplemental Schedules" },
      { id: "state-local", name: "State & Municipal Returns" }
    ]
  };
}
