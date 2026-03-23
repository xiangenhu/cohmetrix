/**
 * Genre Taxonomy
 *
 * 117 genres across 16 categories, sourced from the PenPilot genre catalog
 * (https://pp.skoonline.org/aboutGenre). Each genre includes expectations
 * that inform how the analysis summary evaluates writing quality.
 */

const GENRE_CATEGORIES = [
  {
    category: 'Creative Fiction',
    genres: [
      { id: 'general-fiction', name: 'General Fiction', description: 'Unrestricted prose fiction — creative freedom without genre conventions.' },
      { id: 'literary-fiction', name: 'Literary Fiction', description: 'Character-driven prose emphasizing style, theme, and psychological depth over plot.' },
      { id: 'flash-fiction', name: 'Flash Fiction', description: 'Ultra-short stories (typically under 1,000 words) delivering a complete narrative arc in compressed form.' },
      { id: 'short-story', name: 'Short Story', description: 'Self-contained narrative fiction, typically 1,000–10,000 words with a focused plot and limited characters.' },
      { id: 'novella', name: 'Novella', description: 'Mid-length fiction (10,000–40,000 words) allowing more complexity than a short story but tighter than a novel.' },
      { id: 'historical-fiction', name: 'Historical Fiction', description: 'Fiction set in a past era, blending factual historical settings with imagined characters and events.' },
      { id: 'biographical-fiction', name: 'Biographical Fiction', description: 'Fictionalized account of a real person\'s life, imagining their inner world while respecting known facts.' },
    ],
  },
  {
    category: 'Genre Fiction',
    genres: [
      { id: 'mystery', name: 'Mystery', description: 'Stories centered on solving a puzzle or crime, with clues, red herrings, and a satisfying reveal.' },
      { id: 'thriller', name: 'Thriller', description: 'Fast-paced, high-stakes narratives driven by tension, danger, and suspense.' },
      { id: 'horror', name: 'Horror', description: 'Fiction designed to evoke fear, dread, or unease through supernatural or psychological elements.' },
      { id: 'science-fiction', name: 'Science Fiction', description: 'Speculative fiction exploring the impact of technology, science, or future possibilities on society.' },
      { id: 'fantasy', name: 'Fantasy', description: 'Fiction set in imaginary worlds with magical systems, mythical creatures, and epic quests.' },
      { id: 'romance', name: 'Romance', description: 'Stories centered on a romantic relationship, with emotional development and a satisfying conclusion.' },
      { id: 'adventure', name: 'Adventure', description: 'Action-driven narratives featuring journeys, exploration, and physical challenges.' },
      { id: 'dystopian', name: 'Dystopian', description: 'Fiction set in oppressive, degraded societies that critique current social or political trends.' },
      { id: 'crime', name: 'Crime', description: 'Fiction focused on criminal acts and their consequences, told from any perspective.' },
      { id: 'satire', name: 'Satire', description: 'Fiction using humor, irony, and exaggeration to critique society, politics, or human nature.' },
    ],
  },
  {
    category: 'Young Readers',
    genres: [
      { id: 'childrens-story', name: 'Children\'s Story', description: 'Simple, engaging narratives for ages 5–8 with clear morals and accessible language.' },
      { id: 'middle-grade', name: 'Middle Grade', description: 'Stories for ages 9–12 featuring relatable protagonists and coming-of-age themes.' },
      { id: 'young-adult', name: 'Young Adult', description: 'Fiction for ages 13–17 exploring identity, relationships, and complex emotional landscapes.' },
      { id: 'picture-book', name: 'Picture Book (text)', description: 'Text for illustrated picture books — rhythmic, repetitive, and designed to be read aloud.' },
      { id: 'fable-fairy-tale', name: 'Fable / Fairy Tale', description: 'Traditional story forms with moral lessons, archetypal characters, and timeless narrative patterns.' },
    ],
  },
  {
    category: 'Poetry & Verse',
    genres: [
      { id: 'poetry-general', name: 'Poetry (General)', description: 'Open-form poetry without constraints on structure, meter, or rhyme.' },
      { id: 'free-verse', name: 'Free Verse', description: 'Poetry without fixed meter or rhyme, relying on natural speech rhythms and imagery.' },
      { id: 'sonnet', name: 'Sonnet', description: '14-line poem in iambic pentameter, following Shakespearean or Petrarchan rhyme schemes.' },
      { id: 'haiku', name: 'Haiku', description: 'Three-line Japanese form (5-7-5 syllables) capturing a moment in nature or emotion.' },
      { id: 'spoken-word', name: 'Spoken Word', description: 'Performance poetry designed for oral delivery, emphasizing rhythm, emotion, and audience connection.' },
      { id: 'song-lyrics', name: 'Song Lyrics', description: 'Words written for musical composition, with verse-chorus structure and singable phrasing.' },
    ],
  },
  {
    category: 'Drama & Script',
    genres: [
      { id: 'screenplay', name: 'Screenplay', description: 'Film/TV scripts with INT./EXT. scene headings, character names in caps, indented dialogue, and transitions.' },
      { id: 'stage-play', name: 'Stage Play', description: 'Theater scripts with act/scene labels, stage directions in brackets, and dramatic dialogue format.' },
      { id: 'monologue', name: 'Monologue', description: 'Single-character dramatic speech with performance beats, pauses, and emotional arc notation.' },
      { id: 'radio-podcast-script', name: 'Radio / Podcast Script', description: 'Audio drama with SFX: and MUSIC: cues, narrator lines, and no visual stage directions.' },
      { id: 'sketch-comedy', name: 'Sketch / Comedy', description: 'Short comedy scripts with scene-setting, rapid-fire dialogue, physical comedy beats, and punchlines.' },
      { id: 'ai-video-script', name: 'AI Video Script', description: 'Scripts optimized for AI-generated video — narration-driven with visual direction notes.' },
    ],
  },
  {
    category: 'Personal & Memoir',
    genres: [
      { id: 'memoir', name: 'Memoir', description: 'Focused personal narrative exploring a specific theme, period, or experience from the author\'s life.' },
      { id: 'autobiography', name: 'Autobiography', description: 'Comprehensive life narrative covering the author\'s full story from birth to present.' },
      { id: 'personal-essay', name: 'Personal Essay', description: 'Reflective essay connecting personal experience to broader themes or universal truths.' },
      { id: 'diary-journal', name: 'Diary / Journal', description: 'Date-based entries written in an immediate, conversational tone capturing daily thoughts and events.' },
      { id: 'travel-writing', name: 'Travel Writing', description: 'Narrative accounts of places visited, blending observation, culture, and personal reflection.' },
      { id: 'letter-correspondence', name: 'Letter / Correspondence', description: 'Epistolary format — personal or formal letters addressed to a specific recipient.' },
    ],
  },
  {
    category: 'Essay & Opinion',
    genres: [
      { id: 'essay-general', name: 'Essay (General)', description: 'Open-form essay without a prescribed structure — exploratory and flexible.' },
      { id: 'argumentative-essay', name: 'Argumentative Essay', description: 'Thesis-driven essay presenting evidence to support a specific position on a debatable topic.' },
      { id: 'persuasive-essay', name: 'Persuasive Essay', description: 'Essay designed to convince the reader using emotional appeals, logic, and rhetorical devices.' },
      { id: 'expository-essay', name: 'Expository Essay', description: 'Informational essay that explains a topic clearly and objectively without personal opinion.' },
      { id: 'compare-contrast', name: 'Compare & Contrast', description: 'Essay analyzing similarities and differences between two or more subjects.' },
      { id: 'cause-effect', name: 'Cause & Effect', description: 'Essay examining why something happens (causes) and what results (effects).' },
      { id: 'editorial-oped', name: 'Editorial / Op-Ed', description: 'Opinion piece for publication, taking a clear stance on a current issue with supporting arguments.' },
      { id: 'book-film-review', name: 'Book / Film Review', description: 'Critical evaluation of a creative work, balancing summary, analysis, and recommendation.' },
      { id: 'critical-analysis', name: 'Critical Analysis', description: 'In-depth examination of a text, argument, or concept, evaluating its strengths and weaknesses.' },
      { id: 'reflection-paper', name: 'Reflection Paper', description: 'Personal academic reflection connecting coursework, readings, or experiences to learning outcomes.' },
    ],
  },
  {
    category: 'Academic',
    genres: [
      { id: 'academic-general', name: 'Academic Writing (General)', description: 'Formal scholarly prose following academic conventions — citations, evidence-based arguments, objective tone.' },
      { id: 'research-paper', name: 'Research Paper', description: 'Original research with introduction, methodology, results, and discussion (IMRaD structure).' },
      { id: 'literature-review', name: 'Literature Review', description: 'Comprehensive survey and synthesis of existing research on a specific topic.' },
      { id: 'annotated-bibliography', name: 'Annotated Bibliography', description: 'List of sources with brief summaries and evaluations of each work\'s relevance and quality.' },
      { id: 'lab-report', name: 'Lab Report', description: 'Scientific report documenting an experiment\'s purpose, methods, results, and conclusions.' },
      { id: 'thesis-dissertation', name: 'Thesis / Dissertation', description: 'Extended scholarly work presenting original research for an advanced degree.' },
      { id: 'term-paper', name: 'Term Paper', description: 'Major academic assignment synthesizing course material with independent research.' },
      { id: 'discussion-post', name: 'Discussion Post', description: 'Online forum contribution responding to course prompts with evidence-based reasoning.' },
      { id: 'abstract', name: 'Abstract', description: 'Concise summary (150–300 words) of a research paper\'s key points and findings.' },
      { id: 'conference-paper', name: 'Conference Paper', description: 'Research paper prepared for academic conference presentation and proceedings.' },
    ],
  },
  {
    category: 'Research & Scholarly',
    genres: [
      { id: 'grant-proposal', name: 'Grant Proposal', description: 'Funding request document with problem statement, methodology, budget justification, and expected outcomes.' },
      { id: 'case-study', name: 'Case Study', description: 'In-depth analysis of a specific instance, event, or organization to illustrate broader principles.' },
      { id: 'systematic-review', name: 'Systematic Review', description: 'Methodical synthesis of all available research on a specific question using predefined criteria.' },
      { id: 'meta-analysis', name: 'Meta-Analysis', description: 'Statistical synthesis combining results from multiple studies to identify overall trends.' },
      { id: 'research-proposal', name: 'Research Proposal', description: 'Plan for a research project outlining questions, methods, timeline, and significance.' },
      { id: 'white-paper', name: 'White Paper', description: 'Authoritative report on a complex issue, presenting evidence and recommending solutions.' },
      { id: 'policy-brief', name: 'Policy Brief', description: 'Concise document summarizing research findings and their policy implications for decision-makers.' },
      { id: 'technical-report', name: 'Technical Report', description: 'Detailed document presenting technical research, findings, and recommendations.' },
    ],
  },
  {
    category: 'Workplace & Communication',
    genres: [
      { id: 'email', name: 'Email', description: 'Professional email with clear subject, body, and call to action.' },
      { id: 'memo', name: 'Memo', description: 'Internal memorandum communicating decisions, policies, or updates within an organization.' },
      { id: 'announcement', name: 'Announcement', description: 'Formal notice about events, changes, or news for an organization or community.' },
      { id: 'meeting-minutes', name: 'Meeting Minutes', description: 'Official record of a meeting\'s discussions, decisions, and action items.' },
      { id: 'meeting-agenda', name: 'Meeting Agenda', description: 'Structured outline of topics, time allocations, and objectives for an upcoming meeting.' },
      { id: 'status-report', name: 'Status Report', description: 'Progress update summarizing completed work, current status, and next steps.' },
      { id: 'performance-review', name: 'Performance Review', description: 'Employee evaluation document assessing achievements, areas for growth, and goals.' },
      { id: 'incident-report', name: 'Incident Report', description: 'Factual account of an event requiring documentation — what happened, when, and what actions were taken.' },
      { id: 'recommendation-letter', name: 'Recommendation Letter', description: 'Letter endorsing a person\'s qualifications, character, and suitability for a role or program.' },
      { id: 'internal-communication', name: 'Internal Communication', description: 'General internal messaging — updates, policy changes, or team communications.' },
      { id: 'project-update', name: 'Project Update', description: 'Brief report on project milestones, risks, and upcoming deliverables.' },
      { id: 'onboarding-document', name: 'Onboarding Document', description: 'Welcome guide for new team members covering processes, tools, and expectations.' },
    ],
  },
  {
    category: 'Professional & Business',
    genres: [
      { id: 'business-report', name: 'Business Report', description: 'Formal report analyzing data, trends, or operations for business decision-making.' },
      { id: 'business-plan', name: 'Business Plan', description: 'Comprehensive document outlining a business strategy, market analysis, and financial projections.' },
      { id: 'proposal', name: 'Proposal', description: 'Document proposing a project, service, or solution to a client or stakeholder.' },
      { id: 'executive-summary', name: 'Executive Summary', description: 'Concise overview of a larger document, highlighting key findings and recommendations.' },
      { id: 'press-release', name: 'Press Release', description: 'Official announcement to media following the inverted pyramid structure.' },
      { id: 'newsletter', name: 'Newsletter', description: 'Periodic publication sharing news, updates, and stories with subscribers or stakeholders.' },
      { id: 'cover-letter', name: 'Cover Letter', description: 'Professional letter accompanying a job application, highlighting qualifications and fit.' },
      { id: 'resume-cv', name: 'Resume / CV', description: 'Structured document summarizing professional experience, skills, and qualifications.' },
      { id: 'sop', name: 'Standard Operating Procedure', description: 'Step-by-step instructions for performing a routine operation consistently and correctly.' },
      { id: 'pitch-presentation', name: 'Pitch / Presentation Script', description: 'Speaker notes and talking points for pitches, keynotes, or business presentations.' },
    ],
  },
  {
    category: 'Journalism & Media',
    genres: [
      { id: 'news-article', name: 'News Article', description: 'Objective reporting of current events using the inverted pyramid structure.' },
      { id: 'feature-article', name: 'Feature Article', description: 'In-depth, narrative-driven piece exploring a topic with more creative freedom than hard news.' },
      { id: 'investigative-piece', name: 'Investigative Piece', description: 'Long-form journalism uncovering hidden facts through research, interviews, and document analysis.' },
      { id: 'interview-writeup', name: 'Interview Write-up', description: 'Article presenting insights from an interview — Q&A format or narrative synthesis.' },
      { id: 'profile', name: 'Profile', description: 'Character-focused piece painting a vivid portrait of a person through anecdotes and quotes.' },
      { id: 'column', name: 'Column', description: 'Regular opinion or commentary piece with a distinctive personal voice and perspective.' },
    ],
  },
  {
    category: 'Digital & Content',
    genres: [
      { id: 'blog-post', name: 'Blog Post', description: 'Informal web article with a conversational tone, subheadings, and engagement-focused structure.' },
      { id: 'social-media', name: 'Social Media Content', description: 'Platform-specific content optimized for engagement and character limits.' },
      { id: 'copywriting', name: 'Copywriting', description: 'Persuasive writing designed to drive action — purchases, sign-ups, or engagement.' },
      { id: 'seo-content', name: 'SEO Content', description: 'Search-optimized articles balancing keyword targeting with genuine value for readers.' },
      { id: 'email-campaign', name: 'Email Campaign', description: 'Marketing emails with compelling subject lines, body copy, and calls to action.' },
      { id: 'product-description', name: 'Product Description', description: 'Compelling copy showcasing product features, benefits, and use cases.' },
      { id: 'landing-page', name: 'Landing Page Copy', description: 'Conversion-focused web copy with headlines, value propositions, and clear CTAs.' },
    ],
  },
  {
    category: 'Technical & Instructional',
    genres: [
      { id: 'technical-writing', name: 'Technical Writing', description: 'Clear, precise documentation of technical concepts, systems, or procedures.' },
      { id: 'user-manual', name: 'User Manual', description: 'Step-by-step guide helping users operate a product, software, or system.' },
      { id: 'tutorial-howto', name: 'Tutorial / How-To', description: 'Instructional content teaching a skill or process through sequential, actionable steps.' },
      { id: 'api-documentation', name: 'API Documentation', description: 'Reference documentation for software APIs — endpoints, parameters, examples, and error codes.' },
      { id: 'readme-project-docs', name: 'README / Project Docs', description: 'Project overview documentation covering setup, usage, configuration, and contribution guidelines.' },
      { id: 'training-material', name: 'Training Material', description: 'Educational content for workshops, courses, or onboarding programs with learning objectives.' },
    ],
  },
  {
    category: 'Non-Fiction',
    genres: [
      { id: 'nonfiction-general', name: 'Non-Fiction (General)', description: 'Open-form non-fiction without specific genre constraints.' },
      { id: 'self-help', name: 'Self-Help', description: 'Practical guidance for personal improvement, combining advice with motivational framing.' },
      { id: 'true-crime', name: 'True Crime', description: 'Factual accounts of criminal cases, investigations, and justice.' },
      { id: 'popular-science', name: 'Popular Science', description: 'Accessible explanations of scientific concepts for general audiences.' },
      { id: 'history', name: 'History', description: 'Non-fiction accounts of historical events, periods, or figures based on research and primary sources.' },
      { id: 'philosophy', name: 'Philosophy', description: 'Exploratory writing examining fundamental questions about existence, knowledge, ethics, and meaning.' },
      { id: 'speech', name: 'Speech', description: 'Formal address written for oral delivery — persuasive, ceremonial, or informational.' },
    ],
  },
  {
    category: 'Other',
    genres: [
      { id: 'other', name: 'Other', description: 'Freeform writing — define your own genre through style, tone, and custom instructions.' },
    ],
  },
];

/**
 * Genre expectations for analysis summary — maps genre characteristics
 * to what the dimensional analysis should emphasize or de-emphasize.
 */
const GENRE_EXPECTATIONS = {
  // ── Creative Fiction ──
  'general-fiction':       { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'General Fiction' },
  'literary-fiction':      { type: 'narrative', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Literary Fiction' },
  'flash-fiction':         { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Flash Fiction' },
  'short-story':           { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Short Story' },
  'novella':               { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Novella' },
  'historical-fiction':    { type: 'narrative', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Historical Fiction' },
  'biographical-fiction':  { type: 'narrative', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Biographical Fiction' },

  // ── Genre Fiction ──
  'mystery':               { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Mystery' },
  'thriller':              { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'high', hedging: 'low', citation: false, label: 'Thriller' },
  'horror':                { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'high', hedging: 'low', citation: false, label: 'Horror' },
  'science-fiction':       { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'moderate', situation: 'high', hedging: 'low', citation: false, label: 'Science Fiction' },
  'fantasy':               { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Fantasy' },
  'romance':               { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'high', hedging: 'low', citation: false, label: 'Romance' },
  'adventure':             { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Adventure' },
  'dystopian':             { type: 'narrative', formality: 'flexible', argumentation: 'implicit', affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Dystopian' },
  'crime':                 { type: 'narrative', formality: 'flexible', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Crime' },
  'satire':                { type: 'narrative', formality: 'flexible', argumentation: 'implicit', affect: 'high', situation: 'moderate', hedging: 'low', citation: false, label: 'Satire' },

  // ── Young Readers ──
  'childrens-story':       { type: 'narrative', formality: 'simple', argumentation: false, affect: 'high', situation: 'high', hedging: 'none', citation: false, label: "Children's Story" },
  'middle-grade':          { type: 'narrative', formality: 'accessible', argumentation: false, affect: 'high', situation: 'high', hedging: 'none', citation: false, label: 'Middle Grade' },
  'young-adult':           { type: 'narrative', formality: 'accessible', argumentation: false, affect: 'very-high', situation: 'high', hedging: 'low', citation: false, label: 'Young Adult' },
  'picture-book':          { type: 'narrative', formality: 'simple', argumentation: false, affect: 'high', situation: 'moderate', hedging: 'none', citation: false, label: 'Picture Book' },
  'fable-fairy-tale':      { type: 'narrative', formality: 'simple', argumentation: false, affect: 'high', situation: 'high', hedging: 'none', citation: false, label: 'Fable / Fairy Tale' },

  // ── Poetry & Verse ──
  'poetry-general':        { type: 'poetic', formality: 'literary', argumentation: false, affect: 'very-high', situation: 'moderate', hedging: 'low', citation: false, label: 'Poetry' },
  'free-verse':            { type: 'poetic', formality: 'literary', argumentation: false, affect: 'very-high', situation: 'moderate', hedging: 'low', citation: false, label: 'Free Verse' },
  'sonnet':                { type: 'poetic', formality: 'literary', argumentation: false, affect: 'very-high', situation: 'moderate', hedging: 'low', citation: false, label: 'Sonnet' },
  'haiku':                 { type: 'poetic', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'none', citation: false, label: 'Haiku' },
  'spoken-word':           { type: 'poetic', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'moderate', hedging: 'low', citation: false, label: 'Spoken Word' },
  'song-lyrics':           { type: 'poetic', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'moderate', hedging: 'none', citation: false, label: 'Song Lyrics' },

  // ── Drama & Script ──
  'screenplay':            { type: 'dramatic', formality: 'technical', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Screenplay' },
  'stage-play':            { type: 'dramatic', formality: 'technical', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Stage Play' },
  'monologue':             { type: 'dramatic', formality: 'flexible', argumentation: false, affect: 'very-high', situation: 'high', hedging: 'low', citation: false, label: 'Monologue' },
  'radio-podcast-script':  { type: 'dramatic', formality: 'technical', argumentation: false, affect: 'moderate', situation: 'moderate', hedging: 'low', citation: false, label: 'Radio / Podcast Script' },
  'sketch-comedy':         { type: 'dramatic', formality: 'flexible', argumentation: false, affect: 'high', situation: 'moderate', hedging: 'none', citation: false, label: 'Sketch / Comedy' },
  'ai-video-script':       { type: 'dramatic', formality: 'technical', argumentation: false, affect: 'moderate', situation: 'moderate', hedging: 'low', citation: false, label: 'AI Video Script' },

  // ── Personal & Memoir ──
  'memoir':                { type: 'personal-narrative', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Memoir' },
  'autobiography':         { type: 'personal-narrative', formality: 'literary', argumentation: false, affect: 'high', situation: 'high', hedging: 'low', citation: false, label: 'Autobiography' },
  'personal-essay':        { type: 'reflective', formality: 'semi-formal', argumentation: 'light', affect: 'moderate', situation: 'moderate', hedging: 'moderate', citation: false, label: 'Personal Essay' },
  'diary-journal':         { type: 'personal-narrative', formality: 'informal', argumentation: false, affect: 'high', situation: 'moderate', hedging: 'low', citation: false, label: 'Diary / Journal' },
  'travel-writing':        { type: 'personal-narrative', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'high', hedging: 'low', citation: false, label: 'Travel Writing' },
  'letter-correspondence': { type: 'personal-narrative', formality: 'flexible', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'low', citation: false, label: 'Letter / Correspondence' },

  // ── Essay & Opinion ──
  'essay-general':         { type: 'expository', formality: 'semi-formal', argumentation: 'light', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Essay (General)' },
  'argumentative-essay':   { type: 'argumentative', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'expected', label: 'Argumentative Essay' },
  'persuasive-essay':      { type: 'argumentative', formality: 'semi-formal', argumentation: 'required', affect: 'moderate', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Persuasive Essay' },
  'expository-essay':      { type: 'expository', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Expository Essay' },
  'compare-contrast':      { type: 'expository', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Compare & Contrast' },
  'cause-effect':          { type: 'expository', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'moderate', hedging: 'moderate', citation: 'optional', label: 'Cause & Effect' },
  'editorial-oped':        { type: 'argumentative', formality: 'semi-formal', argumentation: 'required', affect: 'moderate', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Editorial / Op-Ed' },
  'book-film-review':      { type: 'evaluative', formality: 'semi-formal', argumentation: 'light', affect: 'moderate', situation: 'moderate', hedging: 'moderate', citation: false, label: 'Book / Film Review' },
  'critical-analysis':     { type: 'argumentative', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'expected', label: 'Critical Analysis' },
  'reflection-paper':      { type: 'reflective', formality: 'semi-formal', argumentation: 'light', affect: 'moderate', situation: 'moderate', hedging: 'moderate', citation: 'optional', label: 'Reflection Paper' },

  // ── Academic ──
  'academic-general':      { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Academic Writing' },
  'research-paper':        { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Research Paper' },
  'literature-review':     { type: 'academic', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Literature Review' },
  'annotated-bibliography': { type: 'academic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'moderate', citation: 'required', label: 'Annotated Bibliography' },
  'lab-report':            { type: 'academic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Lab Report' },
  'thesis-dissertation':   { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Thesis / Dissertation' },
  'term-paper':            { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'expected', label: 'Term Paper' },
  'discussion-post':       { type: 'academic', formality: 'semi-formal', argumentation: 'light', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Discussion Post' },
  'abstract':              { type: 'academic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'required', citation: false, label: 'Abstract' },
  'conference-paper':      { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Conference Paper' },

  // ── Research & Scholarly ──
  'grant-proposal':        { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'expected', label: 'Grant Proposal' },
  'case-study':            { type: 'academic', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'moderate', hedging: 'required', citation: 'required', label: 'Case Study' },
  'systematic-review':     { type: 'academic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Systematic Review' },
  'meta-analysis':         { type: 'academic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'required', citation: 'required', label: 'Meta-Analysis' },
  'research-proposal':     { type: 'academic', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'expected', label: 'Research Proposal' },
  'white-paper':           { type: 'professional', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'expected', label: 'White Paper' },
  'policy-brief':          { type: 'professional', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'expected', label: 'Policy Brief' },
  'technical-report':      { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'moderate', citation: 'expected', label: 'Technical Report' },

  // ── Workplace & Communication ──
  'email':                 { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Email' },
  'memo':                  { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Memo' },
  'announcement':          { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Announcement' },
  'meeting-minutes':       { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Meeting Minutes' },
  'meeting-agenda':        { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Meeting Agenda' },
  'status-report':         { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Status Report' },
  'performance-review':    { type: 'professional', formality: 'formal', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'moderate', citation: false, label: 'Performance Review' },
  'incident-report':       { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'moderate', hedging: 'low', citation: false, label: 'Incident Report' },
  'recommendation-letter': { type: 'professional', formality: 'formal', argumentation: 'light', affect: 'moderate', situation: 'low', hedging: 'moderate', citation: false, label: 'Recommendation Letter' },
  'internal-communication': { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Internal Communication' },
  'project-update':        { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Project Update' },
  'onboarding-document':   { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Onboarding Document' },

  // ── Professional & Business ──
  'business-report':       { type: 'professional', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Business Report' },
  'business-plan':         { type: 'professional', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Business Plan' },
  'proposal':              { type: 'professional', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Proposal' },
  'executive-summary':     { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'moderate', citation: false, label: 'Executive Summary' },
  'press-release':         { type: 'journalistic', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Press Release' },
  'newsletter':            { type: 'professional', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'low', citation: false, label: 'Newsletter' },
  'cover-letter':          { type: 'professional', formality: 'formal', argumentation: 'light', affect: 'moderate', situation: 'low', hedging: 'moderate', citation: false, label: 'Cover Letter' },
  'resume-cv':             { type: 'professional', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'none', citation: false, label: 'Resume / CV' },
  'sop':                   { type: 'technical', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'none', citation: false, label: 'Standard Operating Procedure' },
  'pitch-presentation':    { type: 'professional', formality: 'semi-formal', argumentation: 'required', affect: 'moderate', situation: 'low', hedging: 'low', citation: 'optional', label: 'Pitch / Presentation' },

  // ── Journalism & Media ──
  'news-article':          { type: 'journalistic', formality: 'formal', argumentation: false, affect: 'low', situation: 'moderate', hedging: 'moderate', citation: 'expected', label: 'News Article' },
  'feature-article':       { type: 'journalistic', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'moderate', hedging: 'moderate', citation: 'optional', label: 'Feature Article' },
  'investigative-piece':   { type: 'journalistic', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'moderate', hedging: 'required', citation: 'required', label: 'Investigative Piece' },
  'interview-writeup':     { type: 'journalistic', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'moderate', hedging: 'low', citation: false, label: 'Interview Write-up' },
  'profile':               { type: 'journalistic', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'high', hedging: 'low', citation: false, label: 'Profile' },
  'column':                { type: 'journalistic', formality: 'semi-formal', argumentation: 'light', affect: 'moderate', situation: 'low', hedging: 'moderate', citation: false, label: 'Column' },

  // ── Digital & Content ──
  'blog-post':             { type: 'digital', formality: 'informal', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'low', citation: false, label: 'Blog Post' },
  'social-media':          { type: 'digital', formality: 'informal', argumentation: false, affect: 'high', situation: 'low', hedging: 'none', citation: false, label: 'Social Media' },
  'copywriting':           { type: 'digital', formality: 'informal', argumentation: 'implicit', affect: 'high', situation: 'low', hedging: 'none', citation: false, label: 'Copywriting' },
  'seo-content':           { type: 'digital', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'SEO Content' },
  'email-campaign':        { type: 'digital', formality: 'semi-formal', argumentation: 'implicit', affect: 'moderate', situation: 'low', hedging: 'none', citation: false, label: 'Email Campaign' },
  'product-description':   { type: 'digital', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'none', citation: false, label: 'Product Description' },
  'landing-page':          { type: 'digital', formality: 'semi-formal', argumentation: 'implicit', affect: 'moderate', situation: 'low', hedging: 'none', citation: false, label: 'Landing Page' },

  // ── Technical & Instructional ──
  'technical-writing':     { type: 'technical', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'moderate', citation: 'optional', label: 'Technical Writing' },
  'user-manual':           { type: 'technical', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'none', citation: false, label: 'User Manual' },
  'tutorial-howto':        { type: 'technical', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'Tutorial / How-To' },
  'api-documentation':     { type: 'technical', formality: 'formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'none', citation: false, label: 'API Documentation' },
  'readme-project-docs':   { type: 'technical', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'low', hedging: 'low', citation: false, label: 'README / Project Docs' },
  'training-material':     { type: 'technical', formality: 'semi-formal', argumentation: false, affect: 'moderate', situation: 'low', hedging: 'low', citation: 'optional', label: 'Training Material' },

  // ── Non-Fiction ──
  'nonfiction-general':    { type: 'expository', formality: 'semi-formal', argumentation: 'light', affect: 'moderate', situation: 'moderate', hedging: 'moderate', citation: 'optional', label: 'Non-Fiction' },
  'self-help':             { type: 'expository', formality: 'semi-formal', argumentation: 'light', affect: 'high', situation: 'moderate', hedging: 'low', citation: 'optional', label: 'Self-Help' },
  'true-crime':            { type: 'narrative', formality: 'semi-formal', argumentation: false, affect: 'high', situation: 'high', hedging: 'moderate', citation: 'expected', label: 'True Crime' },
  'popular-science':       { type: 'expository', formality: 'semi-formal', argumentation: false, affect: 'low', situation: 'moderate', hedging: 'required', citation: 'expected', label: 'Popular Science' },
  'history':               { type: 'expository', formality: 'formal', argumentation: 'light', affect: 'low', situation: 'high', hedging: 'required', citation: 'required', label: 'History' },
  'philosophy':            { type: 'argumentative', formality: 'formal', argumentation: 'required', affect: 'low', situation: 'low', hedging: 'required', citation: 'expected', label: 'Philosophy' },
  'speech':                { type: 'rhetorical', formality: 'flexible', argumentation: 'light', affect: 'high', situation: 'moderate', hedging: 'low', citation: false, label: 'Speech' },

  // ── Other ──
  'other':                 { type: 'flexible', formality: 'flexible', argumentation: 'flexible', affect: 'flexible', situation: 'flexible', hedging: 'flexible', citation: 'flexible', label: 'Other' },
};

/**
 * Build a genre-aware context string for the summary LLM prompt.
 */
function getGenreContext(genreId) {
  const exp = GENRE_EXPECTATIONS[genreId];
  if (!exp) return '';

  const lines = [`This document is a ${exp.label} (${exp.type} genre, ${exp.formality} register).`];
  lines.push('Genre-specific evaluation criteria:');

  // Argumentation
  if (exp.argumentation === 'required') {
    lines.push('- Argumentation is CENTRAL to this genre. Evaluate L7-L8 (rhetoric, claim-evidence structure) rigorously.');
  } else if (exp.argumentation === 'light') {
    lines.push('- Some argumentation is expected but not the primary purpose. Note L7-L8 strengths/weaknesses lightly.');
  } else if (exp.argumentation === 'implicit') {
    lines.push('- Argumentation may be implicit (through narrative or persuasion) rather than Toulmin-style. Do not penalize lack of formal argument structure.');
  } else if (!exp.argumentation || exp.argumentation === false) {
    lines.push('- Formal argumentation is NOT expected in this genre. De-emphasize L7-L8 and do not penalize low argumentation scores.');
  }

  // Affect
  if (exp.affect === 'very-high' || exp.affect === 'high') {
    lines.push('- High emotional engagement and affect are APPROPRIATE and expected. Do not penalize high arousal, valence variability, or emotional language in L10.');
  } else if (exp.affect === 'low') {
    lines.push('- Emotional restraint is expected. Flag any emotional intrusion or high arousal as potentially inappropriate.');
  }

  // Situation model
  if (exp.situation === 'high') {
    lines.push('- Strong situation model (L6) is expected: causal chains, temporal/spatial grounding, protagonist continuity are important.');
  } else if (exp.situation === 'low') {
    lines.push('- Situation model metrics (L6) are less relevant. Do not penalize low spatial/temporal grounding.');
  }

  // Hedging
  if (exp.hedging === 'required') {
    lines.push('- Epistemic hedging (L9) is critical. Claims should be appropriately qualified.');
  } else if (exp.hedging === 'none' || exp.hedging === 'low') {
    lines.push('- Hedging is not expected in this genre. Do not penalize low hedging density.');
  }

  // Citation
  if (exp.citation === 'required') {
    lines.push('- Source attribution and citation (L9 evidentiality) are essential.');
  } else if (exp.citation === 'expected') {
    lines.push('- Some source attribution is expected but not as rigorous as formal academic writing.');
  } else if (!exp.citation || exp.citation === false) {
    lines.push('- Citations are not expected. Do not penalize low evidentiality scores.');
  }

  // Formality
  if (exp.formality === 'formal') {
    lines.push('- Formal register expected: academic vocabulary, low first-person usage, consistent tone.');
  } else if (exp.formality === 'literary') {
    lines.push('- Literary register: rich vocabulary, stylistic variety, and creative expression are valued over academic conventions.');
  } else if (exp.formality === 'informal' || exp.formality === 'simple') {
    lines.push('- Informal/accessible register: simpler vocabulary and shorter sentences are appropriate, not a weakness.');
  }

  return lines.join('\n');
}

/**
 * Look up a genre by ID.
 */
function getGenre(genreId) {
  for (const cat of GENRE_CATEGORIES) {
    const found = cat.genres.find(g => g.id === genreId);
    if (found) return { ...found, category: cat.category };
  }
  return null;
}

module.exports = {
  GENRE_CATEGORIES,
  GENRE_EXPECTATIONS,
  getGenreContext,
  getGenre,
};
