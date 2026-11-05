// Prices are expressed in euro cents. Each merchandise selection is one named item.
const BeybooShop = (() => {
  const english = document.documentElement.lang === 'en';
  const t = (fr, en) => english ? en : fr;
  const format = cents => new Intl.NumberFormat(english ? 'en-IE' : 'fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2
  }).format(cents / 100);
  const classic = 17900, world = 19900;
  const pending = t('Tarif à confirmer', 'Price to be confirmed');
  const items = {
    keychains: [['keyring','Porte-clés peluche','Plush keyring',1490]],
    bottles: [['bottle','Gourde','Water bottle',1590]],
    phone: [['stand','Support téléphone','Phone stand',590],['strap','Dragonne','Phone strap',990],
      ['cardholder','Porte-cartes','Card holder',990],['charm','Bijou de sac','Bag charm',990],
      ['cover','Coque de téléphone','Phone case',1490]],
    bags: [['pencil-case','Trousse','Pencil case',1190],['tote','Tote bag','Tote bag',1490],
      ['backpack','Sac à dos','Backpack',2990]],
    lunch: [['lunch-set','Ensemble repas avec couverts et pochette','Lunch set with cutlery and pouch',2190]],
    stationery: [['bookmarks','Marque-pages','Bookmarks',290],['stickers','Planche d’autocollants','Sticker sheet',390],
      ['pencils','Lot de crayons','Pencil set',490],['notebook','Carnet','Notebook',790]]
  };
  const itemName = item => item[english ? 2 : 1];
  const priceLabel = cents => format(cents) + t(' · écran inclus',' · screen included');
  function familyLabel(id) {
    const options = items[id];
    if (!options) return pending;
    const minimum = Math.min(...options.map(item => item[3]));
    return (options.length > 1 ? t('Dès ','From ') : '') + format(minimum);
  }
  function takeLanguageSelection() {
    try {
      const key = 'beyboo-language-selection';
      const value = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      return value;
    } catch { return null; }
  }
  function restore(saved) {
    const variants = {};
    for (const [id, options] of Object.entries(items)) {
      variants[id] = options.find(item => item[0] === saved?.variants?.[id])?.[0] || options[0][0];
    }
    const edition = worldEditions.find(x => x.id === saved?.edition);
    return {variants, edition: saved?.pack === 'duo' && edition && edition.person === characters.find(x => x.id === saved.character)?.name ? edition.id : ''};
  }
  const selectedItem = id => items[id]?.find(item => item[0] === selection.variants[id]) || items[id]?.[0];
  function breakdown() {
    const edition = worldEditions.find(x => x.id === selection.edition);
    const name = characters.find(x => x.id === selection.character).name;
    const bundle = selection.pack === 'duo';
    const label = bundle ? (edition ? name + ' · ' + edition.country : name) + ' + BEYBOO One' :
      selection.pack === 'plush' ? name + t(' · peluche seule',' · plush only') : t('BEYBOO One · écran seul','BEYBOO One · screen only');
    const rows = [{label, cents: bundle ? (edition ? world : classic) : null}];
    for (const id of selection.accessories) {
      const item = selectedItem(id);
      const product = accessories.find(x => x.id === id);
      if (product) rows.push({label: product.name + (item ? ' · ' + itemName(item) : ''), cents: item?.[3] ?? null});
    }
    return rows;
  }
  function quoteLines() {
    const rows = breakdown();
    const sum = rows.reduce((n, row) => n + (row.cents || 0), 0);
    const incomplete = rows.some(row => row.cents === null);
    const total = incomplete ? t('Sous-total des articles chiffrés','Subtotal of priced items') : t('Total de la sélection','Selection total');
    const totals = sum || !incomplete ? [[total, format(sum)]] : [];
    if (incomplete) totals.push([t('Total complet','Full total'), pending]);
    return [...rows.map(row => [row.label, row.cents === null ? pending : format(row.cents)]), ...totals];
  }
  function renderAccessory(id) {
    const holder = document.querySelector('#accessory-prices');
    holder.replaceChildren();
    if (!items[id]) { holder.textContent = pending; return; }
    for (const item of items[id]) {
      const row = document.createElement('div'), name = document.createElement('span'), price = document.createElement('strong');
      name.textContent = itemName(item); price.textContent = format(item[3]);
      row.append(name,price); holder.append(row);
    }
  }
  function selectEdition(id) {
    const edition = worldEditions.find(x => x.id === id);
    selection.edition = edition?.id || '';
    if (edition) {
      selection.pack = 'duo';
      selection.character = characters.find(x => x.name === edition.person).id;
    }
    renderSelection();
  }
  function render() {
    const q = selector => document.querySelector(selector);
    const edition = worldEditions.find(x => x.id === selection.edition);
    const editionSelect = q('#shop-edition');
    if (!editionSelect.options.length) {
      editionSelect.add(new Option(t('Collection classique','Classic collection'),''));
      for (const e of worldEditions) editionSelect.add(new Option(e.country + ' · ' + e.person, e.id));
    }
    editionSelect.value = selection.edition;
    q('#shop-edition-label').hidden = selection.pack !== 'duo';
    if (edition) {
      q('#selection-image').src = 'assets/world/' + edition.id + '.webp';
      q('#selection-image').alt = edition.alt;
      q('#selection-title').textContent = edition.person + ' · ' + edition.country;
      q('#companion-field').hidden = true;
      q('#accessory-step').textContent = '2';
    }
    for (const input of document.querySelectorAll('[name="pack"]')) {
      const small = input.closest('label').querySelector('small');
      small.textContent = input.value === 'duo' ? priceLabel(edition ? world : classic) : pending;
    }
    const variants = q('#shop-variants'); variants.replaceChildren();
    for (const id of selection.accessories) {
      const group = items[id];
      if (!group || group.length < 2) continue;
      const label = document.createElement('label'), select = document.createElement('select');
      select.dataset.itemFamily = id;
      label.textContent = accessories.find(x => x.id === id).name;
      for (const item of group) select.add(new Option(itemName(item) + ' · ' + format(item[3]), item[0]));
      select.value = selectedItem(id)[0];
      label.append(select);variants.append(label);
    }
    const summary = q('#selection-summary'); summary.replaceChildren();
    if (!edition && selection.pack !== 'screen' && activeLook(selection.character)) {
      const note = document.createElement('p');
      note.textContent = t('Carnation · ','Skin tone · ') + activeLook(selection.character).label;
      summary.append(note);
    }
    const list = document.createElement('dl'); list.className = 'shop-quote';
    for (const [label,price] of quoteLines()) {
      const term = document.createElement('dt'), amount = document.createElement('dd');
      term.textContent = label; amount.textContent = price; list.append(term,amount);
    }
    summary.append(list);
  }
  function bind() {
    document.querySelector('#shop-edition').addEventListener('change',event => selectEdition(event.target.value));
    document.querySelector('#shop-variants').addEventListener('change',event => {
      const id = event.target.dataset.itemFamily;
      if (!items[id]?.some(item => item[0] === event.target.value)) return;
      selection.variants[id] = event.target.value;render();
      document.querySelector('[data-item-family="' + id + '"]').focus({preventScroll:true});
    });
    document.addEventListener('click',event => {
      const link = event.target.closest('[data-pick-edition]');
      if (link) selectEdition(link.dataset.pickEdition);
    });
  }
  return {classic, world, format, priceLabel, familyLabel, renderAccessory, takeLanguageSelection, restore, render, bind, quoteLines};
})();
