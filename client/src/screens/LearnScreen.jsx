import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './LearnScreen.css';

const CATEGORY_ORDER = ['Drivetrain', 'Braking System', 'Bike Tech', 'Tires, Tubes, and Wheels', 'Brakes', 'Tires', 'Suspension', 'Full Bike Service'];

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
  const [open, setOpen] = useState(false);

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

function SearchIcon() {
  return (
    <svg className="learn-search-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function LearnScreen({ onLogout }) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [query,    setQuery]    = useState('');

  useEffect(() => {
    api.getArticles()
      .then(setArticles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const trimmed = query.trim();

  // Search results — flat list filtered across title, description, and category.
  const searchResults = trimmed
    ? articles.filter(a => {
        const q = trimmed.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        );
      })
    : null;

  // Grouped view for when search is empty.
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

        <div className="learn-search-wrap">
          <SearchIcon />
          <input
            className="learn-search-input"
            type="search"
            placeholder="Search articles..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {loading && <p className="learn-status">Loading…</p>}
        {error   && <p className="learn-status learn-status--error">{error}</p>}

        {!loading && !error && searchResults !== null && (
          searchResults.length === 0
            ? <p className="learn-status">No articles found for "{trimmed}"</p>
            : <div className="learn-search-results">
                {searchResults.map(article => (
                  <button
                    key={article.id}
                    className="learn-article-card"
                    onClick={() => navigate(`/learn/${article.id}`)}
                  >
                    <span className="learn-article-category">{article.category}</span>
                    <span className="learn-article-title">{article.title}</span>
                    <span className="learn-article-desc">{article.description}</span>
                  </button>
                ))}
              </div>
        )}

        {!loading && !error && searchResults === null && (
          grouped.length === 0
            ? <p className="learn-status">No articles yet.</p>
            : grouped.map(({ category, items }) => (
                <CategorySection
                  key={category}
                  category={category}
                  articles={items}
                  onSelect={id => navigate(`/learn/${id}`)}
                />
              ))
        )}
      </div>
    </div>
  );
}
