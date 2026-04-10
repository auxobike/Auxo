import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './LearnArticleScreen.css';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ArticleSection({ section }) {
  switch (section.type) {
    case 'intro':
      return <p className="la-intro">{section.content}</p>;

    case 'frequency':
    case 'note':
      return (
        <div className="la-note-block">
          <h3 className="la-section-heading">{section.heading}</h3>
          <p className="la-section-body">{section.content}</p>
        </div>
      );

    case 'supplies':
      return (
        <div className="la-section">
          <h3 className="la-section-heading">{section.heading}</h3>
          <ul className="la-supply-list">
            {section.items.map((item, i) => (
              <li key={i} className="la-supply-item">{item}</li>
            ))}
          </ul>
        </div>
      );

    case 'steps':
      return (
        <div className="la-section">
          <h3 className="la-section-heading">{section.heading}</h3>
          <ol className="la-steps">
            {section.steps.map(step => (
              <li key={step.n} className="la-step">
                <span className="la-step-num">{step.n}</span>
                <div className="la-step-content">
                  <span className="la-step-title">{step.title}</span>
                  <span className="la-step-body">{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'comparison':
      return (
        <div className="la-section">
          <div className="la-comparison-wrap">
            <table className="la-comparison">
              <thead>
                <tr>
                  <th className="la-comparison-th la-comparison-th--label" />
                  <th className="la-comparison-th">{section.colA}</th>
                  {section.colB && <th className="la-comparison-th">{section.colB}</th>}
                  {section.colC && <th className="la-comparison-th">{section.colC}</th>}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i} className="la-comparison-row">
                    <td className="la-comparison-td la-comparison-td--label">{row.label}</td>
                    <td className="la-comparison-td">{row.a}</td>
                    {section.colB && <td className="la-comparison-td">{row.b}</td>}
                    {section.colC && <td className="la-comparison-td">{row.c}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'signs':
      return (
        <div className="la-section">
          <h3 className="la-section-heading">{section.heading}</h3>
          <ul className="la-signs-list">
            {section.items.map((item, i) => (
              <li key={i} className="la-signs-item">{item}</li>
            ))}
          </ul>
        </div>
      );

    case 'proTip':
      return (
        <div className="la-pro-tip">
          <span className="la-pro-tip-label">Pro Tip</span>
          <p className="la-pro-tip-body">{section.content}</p>
        </div>
      );

    default:
      return null;
  }
}

export default function LearnArticleScreen({ onLogout }) {
  const { articleId } = useParams();
  const navigate      = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    api.getArticle(articleId)
      .then(setArticle)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return (
      <div className="screen la-screen">
        <AppHeader onLogout={onLogout} />
        <div className="la-loading">Loading…</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="screen la-screen">
        <AppHeader onLogout={onLogout} />
        <div className="la-error">
          <p>{error || 'Article not found.'}</p>
          <button className="btn-pill btn-pill-outline" onClick={() => navigate('/learn')}>
            Back to Learn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen la-screen">
      <AppHeader onLogout={onLogout} />

      <div className="la-body">
        <button className="la-back" onClick={() => navigate('/learn')}>
          <BackIcon />
          <span>Learn</span>
        </button>

        <div className="la-header">
          <span className="la-category-badge">{article.category}</span>
          <h1 className="la-title">{article.title}</h1>
        </div>

        {article.videoId && (
          <div className="la-video-wrap">
            <iframe
              className="la-video"
              src={`https://www.youtube.com/embed/${article.videoId}`}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="la-content">
          {article.sections.map((section, i) => (
            <ArticleSection key={i} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
