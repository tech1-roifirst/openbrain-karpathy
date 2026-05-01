# Task 5: Dashboard Page

**Agent:** coach-frontend-engineer

**Objective:** Build a responsive dashboard component with data visualization and user interaction.

---

## Input Specification

**Data available:**
```typescript
{
  totalUsers: number;
  recentSignups: Array<{ email: string; name: string; date: string }>;
  signupTrend: Array<{ date: string; count: number }>;
}
```

**Requirement:** Build a dashboard showing:
1. Total user count (prominent large number)
2. Signup trend chart (last 30 days)
3. Recent signups table (last 5 users)
4. Fully responsive (mobile, tablet, desktop)
5. Accessible (WCAG AA compliant)

---

## Output Specification

Generate a React component (TypeScript) that:
- ✅ Renders 3 sections: metric card, chart, table
- ✅ Uses responsive Tailwind CSS (mobile-first)
- ✅ Includes loading state with skeleton
- ✅ Includes error handling with retry button
- ✅ Semantic HTML with ARIA labels
- ✅ Keyboard navigation support (Tab, Focus management)
- ✅ Fetches data via useEffect on mount

---

## Success Criteria

- ✅ Compiles without TypeScript errors
- ✅ Passes Playwright E2E tests:
  1. Page loads and displays total user count
  2. Chart renders with data points
  3. Recent signups table shows 5 rows with email/name/date
  4. Responsive: mobile view stacks vertically, desktop columns side-by-side
  5. Keyboard navigation works (Tab through all interactive elements)
  6. Loading state shows skeleton while fetching
  7. Error state shows retry button
- ✅ WCAG AA accessibility score (Lighthouse report)
- ✅ No console errors or warnings

---

## Notes

- Use a chart library (Recharts, Chart.js) for the trend visualization
- Mock data fetching with useEffect (can use fake API call)
- Ensure proper color contrast for accessibility
- Include alt text for images
- Test on Chrome, Firefox, Safari (Playwright handles this)
