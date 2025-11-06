import React from 'react';

function CourseContent({ courseData }) {
  if (!courseData) return null;

  return (
    <section className="content-card" aria-labelledby="course-title">
      {courseData.course_title && (
        <header className="content-card__header">
          <h1 id="course-title" className="content-card__title">
            {courseData.course_title}
          </h1>
        </header>
      )}

      <div className="content-card__scroll">
        {Array.isArray(courseData.sections) && courseData.sections.length > 0 ? (
          courseData.sections.map((section, idx) => (
            <article key={idx} className="content-section">
              {section.heading && (
                <h2 className="content-section__heading">{section.heading}</h2>
              )}
              {Array.isArray(section.paragraphs) &&
                section.paragraphs.map((para, pIdx) => (
                  <p key={pIdx} className="content-section__paragraph">
                    {para}
                  </p>
                ))}
            </article>
          ))
        ) : (
          <p className="content-section__paragraph">No sections available.</p>
        )}
      </div>
    </section>
  );
}

export default CourseContent;
