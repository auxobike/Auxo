import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './LearnScreen.css';

const CATEGORY_ORDER = ['Drivetrain', 'Braking System', 'Bike Tech', 'Brakes', 'Tires', 'Suspension', 'Full Bike Service'];

function ChevronIcon({ open }) {
  return (
    <svg
      className={`learn-chevron${open ? ' learn-chevron--open' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CategorySection({ category, articles, onSelect }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="learn-category">
      <button className="learn-category-header" onClick={() => setOpen(o => !o)}>
        <span className="learn-category-name">{category}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="learn-category-articles">
          {articles.map(article => (
            <button
              key={article.id}
              className="learn-article-card"
              onClick={() => onSelect(article.id)}
            >
              <span className="learn-article-title">{article.title}</span>
              <span className="learn-article-desc">{article.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearnScreen({ onLogout }) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    api.getArticles()
      .then(setArticles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Group articles by category, preserving CATEGORY_ORDER; skip empty categories.
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = articles.filter(a => a.category === cat);
    if (items.length) acc.push({ category: cat, items });
    return acc;
  }, []);

  return (
    <div className="screen learn-screen">
      <AppHeader onLogout={onLogout} />

      <div className="learn-body">
        <h1 className="learn-heading">Learn</h1>

        {loading && <p className="learn-status">Loading…</p>}
        {error   && <p className="learn-status learn-status--error">{error}</p>}
        {!loading && !error && grouped.length === 0 && (
          <p className="learn-status">No articles yet.</p>
        )}

        {!loading && !error && grouped.map(({ category, items }) => (
          <CategorySection
            key={category}
            category={category}
            articles={items}
            onSelect={id => navigate(`/learn/${id}`)}
          />
        ))}
      </div>
    </div>
  );
}
