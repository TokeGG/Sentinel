import type { ModuleManifest } from "../../core/module";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useLimit, useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { CourseCard } from "./CourseCard";
import { CourseForm } from "./CourseForm";
import type { Course } from "./logic";
import { barPct, coursesOptions, hm } from "./panelLogic";
import { sortCourses, upcoming, weekTotals, whenText, type SortKey } from "./plan";
import "./courses.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const courses = rows as unknown as Course[];
  const today = new Date().toISOString().slice(0, 10);
  const sort = useOption<string>("sort", "order") as SortKey;
  const showDone = useOption("showDone", true);
  const soon = upcoming(courses, today, useLimit(coursesOptions, "soonDays"));
  const goal = useLimit(coursesOptions, "goalMins");
  const weeks = weekTotals(courses, today, useLimit(coursesOptions, "weeks"));
  const logMins = useLimit(coursesOptions, "logMins");
  const max = Math.max(0, ...weeks.map((w) => w.mins));
  const list = sortCourses(courses, sort, showDone, today);
  return (
    <div className="co-root">
      <h2 className="ui-head"><span className="ui-dot" />{module.name}<span className="ui-count">{courses.length}</span></h2>
      {error && <ErrorLine message={error} />}
      <Sections className="co-grid">
        <Section id="upcoming">
          <h3 className="ui-meta">Coming up</h3>
          {soon.length === 0 ? <p className="ui-meta">Nothing due soon.</p> : (
            <ul className="co-dates">
              {soon.map((u) => <li key={`${u.courseId}-${u.index}`}><b>{whenText(u.inDays)}</b> <span>{u.kind === "exam" ? "Exam" : "Due"}: {u.label}</span> <span className="ui-meta">{u.course}</span></li>)}
            </ul>
          )}
        </Section>
        <Section id="courses">
          {list.length === 0 ? <EmptyState title="No courses yet" hint="Add your first class or course below." /> : (
            <div className="co-list">{list.map((c) => <CourseCard key={c.id} c={c} busy={busy} run={run} logMins={logMins} today={today} />)}</div>
          )}
        </Section>
        <Section id="time">
          <h3 className="ui-meta">Study time per week{goal > 0 ? ` (goal ${hm(goal)})` : ""}</h3>
          <ul className="co-weeks">
            {weeks.map((w) => (
              <li key={w.week}><span className="ui-meta">{w.week}</span><span className="co-bar"><i style={{ width: `${barPct(w.mins, goal, max)}%` }} /></span><span>{hm(w.mins)}</span></li>
            ))}
          </ul>
        </Section>
        <Section id="add">
          <h3 className="ui-meta">Add a course</h3>
          <CourseForm busy={busy} onSave={(d) => run("save_course", d)} />
        </Section>
      </Sections>
    </div>
  );
}
