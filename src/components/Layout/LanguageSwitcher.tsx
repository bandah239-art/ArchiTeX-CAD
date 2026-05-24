import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => {
        i18n.changeLanguage(e.target.value);
        localStorage.setItem('infra_lang', e.target.value);
      }}
      className="px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-gray-300"
      aria-label="Language"
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
    </select>
  );
}
