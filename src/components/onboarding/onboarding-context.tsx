"use client"

import { createContext, useContext } from "react"

const OnboardingWizardContext = createContext<{ openWizard: () => void } | null>(null)

export const OnboardingWizardProvider = OnboardingWizardContext.Provider

export function useOnboardingWizard(): { openWizard: () => void } {
  const value = useContext(OnboardingWizardContext)
  if (!value) throw new Error("useOnboardingWizard muss innerhalb der App-Hülle stehen.")
  return value
}
