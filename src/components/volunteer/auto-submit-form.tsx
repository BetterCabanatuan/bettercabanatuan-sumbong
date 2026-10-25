"use client";

import type { ComponentProps } from "react";

/**
 * A GET filter form that applies itself when a field changes. The Filter button stays in the form,
 * so without JavaScript it still works the old way.
 */
export function AutoSubmitForm(props: ComponentProps<"form">) {
  return <form {...props} onChange={(event) => event.currentTarget.requestSubmit()} />;
}
