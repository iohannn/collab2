require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;

// Helper functions
const genId = (prefix) => `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
const now = () => new Date().toISOString();
const hashPassword = (password) => bcrypt.hashSync(password, 10);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Romanian first and last names
const firstNames = ['Alexandru', 'Maria', 'Andrei', 'Elena', 'Mihai', 'Ana', 'Ion', 'Ioana', 'George', 'Cristina', 'Adrian', 'Diana', 'Vlad', 'Alina', 'Stefan', 'Roxana', 'Daniel', 'Laura', 'Florin', 'Simona'];
const lastNames = ['Popescu', 'Ionescu', 'Popa', 'Dumitru', 'Stan', 'Stoica', 'Gheorghe', 'Rusu', 'Munteanu', 'Matei', 'Constantin', 'Serban', 'Moldovan', 'Nistor', 'Dragomir', 'Tudor', 'Barbu', 'Diaconu', 'Ene', 'Tanase'];

// Data for seeding
const platforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'];
const niches = ['fashion', 'beauty', 'fitness', 'travel', 'food', 'tech', 'gaming', 'lifestyle', 'parenting', 'business', 'music', 'art', 'comedy', 'education'];
const industries = ['Fashion & Retail', 'Beauty & Cosmetics', 'Food & Beverage', 'Technology', 'Health & Fitness', 'Travel & Tourism', 'Entertainment', 'Finance', 'Automotive', 'Home & Living'];

const brandNames = [
  'Fashion Nova RO', 'BeautyBox', 'FitLife Romania', 'TechZone', 'GourmetBites',
  'TravelDreams', 'GamersHub', 'EcoLiving', 'PetCare Plus', 'HomeStyle',
  'SportMax', 'NaturalBeauty', 'UrbanWear', 'HealthFirst', 'FoodieParadise'
];

const collabTitles = [
  'Campanie Instagram Stories pentru lansare produs nou',
  'Review video YouTube pentru gadget tech',
  'Colaborare TikTok pentru challenge viral',
  'Postari Instagram pentru colectia de primavara',
  'Unboxing si review pentru produse beauty',
  'Campanie fitness cu antrenamente si tips',
  'Travel vlog pentru destinatie turistica',
  'Retete si cooking videos pentru brand alimentar',
  'Gaming stream si review pentru joc nou',
  'Lifestyle content pentru brand de moda',
  'Tutorial makeup pentru noua linie de produse',
  'Home decor inspiration pentru brand mobilier',
  'Pet content pentru brand hrana animale',
  'Parenting tips pentru brand produse copii',
  'Tech review pentru smartphone nou'
];

const deliverables = [
  ['1 Instagram Post', '3 Stories'],
  ['1 YouTube Video (10-15 min)', '1 Instagram Post'],
  ['3 TikTok Videos', '1 Instagram Reel'],
  ['2 Instagram Posts', '5 Stories', '1 Reel'],
  ['1 YouTube Review', '2 Instagram Posts'],
  ['5 TikTok Videos', '2 Instagram Reels'],
  ['1 Blog Post', '2 Instagram Posts', '3 Stories'],
  ['1 YouTube Vlog', '3 Instagram Posts', '10 Stories'],
  ['2 Twitch Streams', '3 TikTok Videos'],
  ['4 Instagram Posts', '1 Reel', '5 Stories']
];

const statuses = ['active', 'in_progress', 'completed_pending_release', 'completed', 'cancelled'];
const appStatuses = ['pending', 'accepted', 'rejected'];

async function seed() {
  console.log('🌱 Starting database seeder...\n');
  
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  
  // Clear existing seed data (only items with SEED_ prefix)
  console.log('🧹 Cleaning previous seed data...');
  await db.collection('users').deleteMany({ email: { $regex: /^seed_/ } });
  await db.collection('influencer_profiles').deleteMany({ username: { $regex: /^seed_/ } });
  await db.collection('brand_profiles').deleteMany({ company_name: { $regex: /^SEED_/ } });
  await db.collection('collaborations').deleteMany({ title: { $regex: /^\[SEED\]/ } });
  await db.collection('applications').deleteMany({ message: { $regex: /^\[SEED\]/ } });
  await db.collection('reviews').deleteMany({ comment: { $regex: /^\[SEED\]/ } });
  await db.collection('messages').deleteMany({ content: { $regex: /^\[SEED\]/ } });
  
  // ========== CREATE INFLUENCERS ==========
  console.log('\n👤 Creating influencers...');
  const influencers = [];
  
  for (let i = 1; i <= 15; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const username = `seed_${firstName.toLowerCase()}${lastName.toLowerCase()}${randomInt(1, 99)}`;
    const email = `seed_influencer${i}@test.com`;
    const userId = genId('user');
    
    // Create user
    const user = {
      user_id: userId,
      email,
      name: `${firstName} ${lastName}`,
      password_hash: hashPassword('TestPass123'),
      user_type: 'influencer',
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      is_pro: Math.random() > 0.7,
      pro_expires_at: null,
      is_admin: false,
      created_at: now()
    };
    await db.collection('users').insertOne(user);
    
    // Create influencer profile
    const profile = {
      user_id: userId,
      username,
      bio: `Salut! Sunt ${firstName}, creator de continut ${randomItem(niches)}. Iubesc sa impartasesc experiente autentice cu comunitatea mea de ${randomInt(5, 500)}k urmaritori.`,
      profile_photo: user.picture,
      niches: randomItems(niches, randomInt(2, 4)),
      platforms: randomItems(platforms, randomInt(2, 3)),
      audience_size: randomInt(5000, 500000),
      engagement_rate: randomFloat(1.5, 8.5),
      price_per_post: randomInt(100, 2000),
      price_per_story: randomInt(50, 500),
      price_bundle: randomInt(500, 5000),
      instagram_url: `https://instagram.com/${username}`,
      tiktok_url: Math.random() > 0.3 ? `https://tiktok.com/@${username}` : null,
      youtube_url: Math.random() > 0.5 ? `https://youtube.com/@${username}` : null,
      previous_collaborations: [],
      badges: Math.random() > 0.7 ? ['verified'] : [],
      available: Math.random() > 0.2,
      featured_posts: [],
      avg_rating: randomFloat(3.5, 5.0),
      review_count: randomInt(0, 25)
    };
    await db.collection('influencer_profiles').insertOne(profile);
    
    influencers.push({ user, profile });
    console.log(`  ✓ ${user.name} (@${username})`);
  }
  
  // ========== CREATE BRANDS ==========
  console.log('\n🏢 Creating brands...');
  const brands = [];
  
  for (let i = 1; i <= 10; i++) {
    const brandName = brandNames[i - 1] || `SEED_Brand_${i}`;
    const email = `seed_brand${i}@test.com`;
    const userId = genId('user');
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    
    // Create user
    const user = {
      user_id: userId,
      email,
      name: `${firstName} ${lastName}`,
      password_hash: hashPassword('TestPass123'),
      user_type: 'brand',
      picture: null,
      is_pro: Math.random() > 0.5,
      pro_expires_at: null,
      is_admin: false,
      created_at: now()
    };
    await db.collection('users').insertOne(user);
    
    // Create brand profile
    const profile = {
      user_id: userId,
      company_name: `SEED_${brandName}`,
      website: `https://${brandName.toLowerCase().replace(/\s+/g, '')}.ro`,
      industry: randomItem(industries),
      description: `${brandName} - lider in industria ${randomItem(industries).toLowerCase()}. Cautam mereu colaborari autentice cu creatori de continut.`,
      logo_url: `https://api.dicebear.com/7.x/initials/svg?seed=${brandName}`,
      verified: Math.random() > 0.5
    };
    await db.collection('brand_profiles').insertOne(profile);
    
    brands.push({ user, profile });
    console.log(`  ✓ ${brandName}`);
  }
  
  // ========== CREATE COLLABORATIONS ==========
  console.log('\n📋 Creating collaborations...');
  const collaborations = [];
  
  for (let i = 1; i <= 25; i++) {
    const brand = randomItem(brands);
    const status = randomItem(statuses);
    const collabType = randomItem(['paid', 'paid', 'paid', 'barter', 'free']); // 60% paid
    const budgetMin = randomInt(200, 2000);
    const budgetMax = budgetMin + randomInt(100, 1000);
    const collabId = genId('collab');
    
    const collab = {
      collab_id: collabId,
      brand_user_id: brand.user.user_id,
      brand_name: brand.profile.company_name.replace('SEED_', ''),
      title: `[SEED] ${randomItem(collabTitles)}`,
      description: `Cautam creatori de continut pentru o campanie autentica. Brandul nostru doreste sa colaboreze cu influenceri care se potrivesc cu valorile noastre. Oferim libertate creativa si suport pe parcursul colaborarii.\n\nCerinte:\n- Minim 5k urmaritori\n- Engagement rate peste 2%\n- Continut original si creativ`,
      deliverables: randomItem(deliverables),
      budget_min: budgetMin,
      budget_max: budgetMax,
      deadline: new Date(Date.now() + randomInt(7, 60) * 24 * 60 * 60 * 1000).toISOString(),
      platform: randomItem(platforms),
      creators_needed: randomInt(1, 5),
      status,
      applicants_count: 0,
      views: randomInt(10, 500),
      created_at: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000).toISOString(),
      is_public: true,
      collaboration_type: collabType,
      payment_status: collabType === 'paid' ? 
        (status === 'active' ? randomItem(['awaiting_escrow', 'secured']) : 
         status === 'completed' ? 'released' : 
         status === 'completed_pending_release' ? 'completed_pending_release' : 'none') 
        : 'none'
    };
    
    await db.collection('collaborations').insertOne(collab);
    collaborations.push({ ...collab, brand });
    console.log(`  ✓ ${collab.title.substring(0, 50)}...`);
  }
  
  // ========== CREATE APPLICATIONS ==========
  console.log('\n📝 Creating applications...');
  let appCount = 0;
  const applications = [];
  
  for (const collab of collaborations) {
    const numApps = randomInt(1, 5);
    const selectedInfluencers = randomItems(influencers, numApps);
    
    for (const inf of selectedInfluencers) {
      const status = collab.status === 'active' ? randomItem(appStatuses) : 
                     collab.status === 'cancelled' ? 'rejected' : 'accepted';
      const appId = genId('app');
      
      const app = {
        application_id: appId,
        collab_id: collab.collab_id,
        influencer_user_id: inf.user.user_id,
        influencer_name: inf.user.name,
        influencer_username: inf.profile.username,
        message: `[SEED] Salut! Sunt ${inf.user.name} si as dori sa colaborez cu voi. Am experienta in ${inf.profile.niches.join(', ')} si cred ca m-as potrivi perfect pentru aceasta campanie. Astept cu nerabdare sa discutam detaliile!`,
        selected_deliverables: collab.deliverables.slice(0, randomInt(1, collab.deliverables.length)),
        proposed_price: randomInt(collab.budget_min, collab.budget_max),
        status,
        created_at: now()
      };
      
      await db.collection('applications').insertOne(app);
      applications.push({ ...app, collab, influencer: inf });
      appCount++;
      
      // Update applicants count
      await db.collection('collaborations').updateOne(
        { collab_id: collab.collab_id },
        { $inc: { applicants_count: 1 } }
      );
    }
  }
  console.log(`  ✓ Created ${appCount} applications`);
  
  // ========== CREATE REVIEWS ==========
  console.log('\n⭐ Creating reviews...');
  let reviewCount = 0;
  
  const completedApps = applications.filter(a => 
    a.status === 'accepted' && 
    ['completed', 'completed_pending_release'].includes(a.collab.status)
  );
  
  for (const app of completedApps.slice(0, 20)) {
    // Brand reviews influencer
    if (Math.random() > 0.3) {
      const review = {
        review_id: genId('review'),
        application_id: app.application_id,
        collab_id: app.collab_id,
        reviewer_user_id: app.collab.brand.user.user_id,
        reviewer_name: app.collab.brand.user.name,
        reviewer_type: 'brand',
        reviewed_user_id: app.influencer.user.user_id,
        rating: randomInt(3, 5),
        comment: `[SEED] ${randomItem([
          'Colaborare excelenta! Continut de calitate livrat la timp.',
          'Foarte profesionist si creativ. Recomandat!',
          'Comunicare buna si rezultate peste asteptari.',
          'A fost o placere sa lucram impreuna. Engagement foarte bun!',
          'Creator talentat cu idei originale.'
        ])}`,
        collab_title: app.collab.title,
        is_revealed: Math.random() > 0.4,
        created_at: now()
      };
      await db.collection('reviews').insertOne(review);
      reviewCount++;
    }
    
    // Influencer reviews brand
    if (Math.random() > 0.4) {
      const review = {
        review_id: genId('review'),
        application_id: app.application_id,
        collab_id: app.collab_id,
        reviewer_user_id: app.influencer.user.user_id,
        reviewer_name: app.influencer.user.name,
        reviewer_type: 'influencer',
        reviewed_user_id: app.collab.brand.user.user_id,
        rating: randomInt(3, 5),
        comment: `[SEED] ${randomItem([
          'Brand profesionist cu brief clar. Recomand!',
          'Comunicare excelenta si plata la timp.',
          'A fost o experienta placuta. Libertate creativa totala.',
          'Feedback constructiv si colaborare eficienta.',
          'Brandul stie exact ce vrea. Usor de lucrat cu ei.'
        ])}`,
        collab_title: app.collab.title,
        is_revealed: Math.random() > 0.4,
        created_at: now()
      };
      await db.collection('reviews').insertOne(review);
      reviewCount++;
    }
  }
  console.log(`  ✓ Created ${reviewCount} reviews`);
  
  // ========== CREATE MESSAGES ==========
  console.log('\n💬 Creating messages...');
  let msgCount = 0;
  
  const acceptedApps = applications.filter(a => a.status === 'accepted');
  
  for (const app of acceptedApps.slice(0, 15)) {
    const messages = [
      { sender: 'brand', content: `[SEED] Salut ${app.influencer.user.name.split(' ')[0]}! Multumim pentru aplicatie. Suntem incantati sa colaboram!` },
      { sender: 'influencer', content: `[SEED] Multumesc! Sunt foarte entuziasmata de aceasta oportunitate. Cand putem incepe?` },
      { sender: 'brand', content: `[SEED] Perfect! Iti trimit brieful complet maine. Ai intrebari pana atunci?` },
      { sender: 'influencer', content: `[SEED] Super! Vreau doar sa confirm deadline-ul si daca aveti preferinte pentru ora postarii.` },
      { sender: 'brand', content: `[SEED] Deadline-ul e flexibil, important e calitatea. Pentru ora, seara intre 18-21 ar fi ideal.` }
    ];
    
    for (const msg of messages.slice(0, randomInt(2, 5))) {
      const isBrand = msg.sender === 'brand';
      const msgDoc = {
        message_id: genId('msg'),
        collab_id: app.collab_id,
        sender_id: isBrand ? app.collab.brand.user.user_id : app.influencer.user.user_id,
        sender_name: isBrand ? app.collab.brand.user.name : app.influencer.user.name,
        sender_type: msg.sender,
        content: msg.content,
        created_at: new Date(Date.now() - randomInt(1, 10) * 24 * 60 * 60 * 1000).toISOString(),
        thread_locked: false
      };
      await db.collection('messages').insertOne(msgDoc);
      msgCount++;
    }
  }
  console.log(`  ✓ Created ${msgCount} messages`);
  
  // ========== CREATE ESCROW PAYMENTS ==========
  console.log('\n💰 Creating escrow payments...');
  let escrowCount = 0;
  
  const paidCollabs = collaborations.filter(c => 
    c.collaboration_type === 'paid' && 
    ['secured', 'completed_pending_release', 'released'].includes(c.payment_status)
  );
  
  for (const collab of paidCollabs) {
    const budget = collab.budget_max || collab.budget_min;
    const commission = Math.round(budget * 0.1 * 100) / 100;
    
    const escrow = {
      escrow_id: genId('escrow'),
      collab_id: collab.collab_id,
      brand_user_id: collab.brand.user.user_id,
      total_amount: budget,
      influencer_payout: budget - commission,
      platform_commission: commission,
      commission_rate: 10,
      payment_status: collab.payment_status,
      status: collab.payment_status === 'released' ? 'released' : 
              collab.payment_status === 'completed_pending_release' ? 'completed_pending_release' : 'secured',
      payment_provider: 'mock',
      payment_reference: `pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      created_at: now(),
      secured_at: now()
    };
    
    if (collab.payment_status === 'released') {
      escrow.released_at = now();
    }
    
    await db.collection('escrow_payments').insertOne(escrow);
    escrowCount++;
  }
  console.log(`  ✓ Created ${escrowCount} escrow payments`);
  
  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(50));
  console.log('✅ SEEDING COMPLETE!');
  console.log('='.repeat(50));
  console.log(`
📊 Summary:
   • Influencers: 15
   • Brands: 10  
   • Collaborations: 25
   • Applications: ${appCount}
   • Reviews: ${reviewCount}
   • Messages: ${msgCount}
   • Escrow Payments: ${escrowCount}

🔑 Test Credentials (all use password: TestPass123):
   • Influencers: seed_influencer1@test.com to seed_influencer15@test.com
   • Brands: seed_brand1@test.com to seed_brand10@test.com
   
💡 All seeded data has [SEED] or seed_ prefix for easy identification.
`);
  
  await client.close();
  console.log('Database connection closed.');
}

// Run seeder
seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
