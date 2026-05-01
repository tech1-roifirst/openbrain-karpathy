# Task 6: Form Component with Validation

**Agent:** coach-frontend-engineer

**Objective:** Build a user signup form with client-side validation and error display.

---

## Input Specification

**Form fields:**
```
- email: string (required, must be valid email format)
- password: string (required, min 8 characters)
- terms: checkbox (required, must be checked to submit)
```

**Requirement:** Build a signup form that:
- Validates on blur (show errors as user leaves field)
- Displays field-level error messages inline
- Shows success message on successful submit
- Fully accessible with keyboard navigation
- Submit button disabled until all fields valid

---

## Output Specification

Generate a React form component (TypeScript) that:
- ✅ Manages form state (email, password, terms, errors)
- ✅ Validates on blur (not just on submit)
- ✅ Shows inline error messages below each field
- ✅ Submit button disabled until form.isValid = true
- ✅ On submit: shows success message (mock API call, no actual submit)
- ✅ Semantic HTML with <label> for each input
- ✅ ARIA error attributes for accessibility
- ✅ Keyboard navigation (Tab, Enter to submit)

---

## Success Criteria

- ✅ Compiles without TypeScript errors
- ✅ Passes Playwright E2E tests:
  1. Empty form renders with submit button disabled
  2. Invalid email (e.g., "notanemail") → error message shown on blur
  3. Password < 8 chars → error message shown on blur
  4. Unchecked terms checkbox → error message shown on blur
  5. All fields valid → submit button enabled
  6. Click submit → success message appears (no actual submission)
  7. Keyboard: Tab navigates through all fields
  8. Keyboard: Enter while focused on submit button submits form
- ✅ Error messages are clear and specific (e.g., "Email must be valid format")
- ✅ No console errors or warnings

---

## Notes

- Use React state (or a form library like React Hook Form)
- Validate email with a standard regex or library
- Clear error message when user corrects input
- Success message can be a toast/modal or inline text
- Consider debouncing validation to avoid excessive checks
