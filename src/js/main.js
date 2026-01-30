// Handles routing, state management, and API integrations.
class WanderlustApp {
  constructor() {
    this.state = {
      selectedCountry: '',
      selectedCity: '',
      selectedYear: '2026',
      countryTimezone: 'UTC',
      exploreClicked: false,
      currentPlansFilter: 'all',
      plans: JSON.parse(localStorage.getItem('wanderlust_plans')) || []
    };

    // DOM Elements
    this.elements = {
      navItems: document.querySelectorAll('.nav-item'),
      views: document.querySelectorAll('.view'),
      pageTitle: document.getElementById('page-title'),
      countrySelect: document.getElementById('global-country'),
      countryDropdown: document.getElementById('country-dropdown'),
      countryOptions: document.getElementById('country-options'),
      countrySearch: document.getElementById('country-search'),
      cityDropdown: document.getElementById('city-dropdown'),
      cityOptions: document.getElementById('city-options'),
      yearDropdown: document.getElementById('year-dropdown'),
      yearOptions: document.getElementById('year-options'),
      citySelect: document.getElementById('global-city'),
      yearSelect: document.getElementById('global-year'),
      searchBtn: document.getElementById('global-search-btn'),
      clearBtn: document.getElementById('clear-selection-btn'),
      plansCount: document.getElementById('plans-count'),
      loadingOverlay: document.getElementById('loading-overlay')
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updatePlansBadge();
    this.handleRouting();
    this.updateDateTime();
    
    // Start clock
    setInterval(() => this.updateDateTime(), 1000);
    
    // Initial data load
    this.loadCountries();
  }

  updateDateTime() {
    const globalEl = document.getElementById('current-datetime');
    if (globalEl) {
      const now = new Date();
      globalEl.textContent = now.toLocaleDateString('en', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    // Local time for selected country
    const countryTimeEl = document.getElementById('country-local-time');
    const countryTimeZoneEl = document.querySelector('.local-time-zone');
    
    if (countryTimeEl && this.state.countryTimezone && this.state.exploreClicked) {
      const now = new Date();
      const offsetStr = this.state.countryTimezone;
      
      let offsetMinutes = 0;
      if (offsetStr.includes('+') || offsetStr.includes('-')) {
        const isNegative = offsetStr.includes('-');
        const timePart = offsetStr.replace('UTC', '').replace('+', '').replace('-', '');
        const [hours, mins] = timePart.split(':').map(n => parseInt(n) || 0);
        
        offsetMinutes = (hours * 60) + mins;
        if (isNegative) offsetMinutes = -offsetMinutes;
      }
      
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const countryTime = new Date(utcTime + (offsetMinutes * 60000));
      
      countryTimeEl.textContent = countryTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      if (countryTimeZoneEl && countryTimeZoneEl.textContent !== offsetStr) {
        countryTimeZoneEl.textContent = offsetStr;
      }
    }
  }

  setupEventListeners() {
    // Sidebar navigation
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = item.getAttribute('data-view');
        this.navigateTo(viewName);
      });
    });

    this.setupSidebar();

    // Plan Filters
    document.querySelectorAll('.plan-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.displayPlans(btn.getAttribute('data-filter'));
      });
    });

    // Dashboard Search
    if (this.elements.searchBtn) {
      this.elements.searchBtn.addEventListener('click', () => {
        this.state.selectedCountry = this.elements.countrySelect.value;
        this.state.selectedCity = this.elements.citySelect.value;
        this.state.selectedYear = this.elements.yearSelect.value;
        this.state.exploreClicked = true;
        this.updateDashboard();
      });
    }

    // Country change
    if (this.elements.countrySelect) {
      this.elements.countrySelect.addEventListener('change', (e) => {
        this.loadCities(e.target.value);
      });
    }

    // Custom Dropdown Logic
    const setupCustomDropdown = (dropdownEl, searchEl, optionsEl) => {
      if (!dropdownEl) return;
      const selected = dropdownEl.querySelector('.dropdown-selected');
      
      dropdownEl.addEventListener('click', (e) => e.stopPropagation());
      
      selected.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.custom-dropdown').forEach(d => {
          if (d !== dropdownEl) d.classList.remove('active');
        });
        dropdownEl.classList.toggle('active');
        if (searchEl && dropdownEl.classList.contains('active')) {
          searchEl.focus();
        }
      });

      if (searchEl && optionsEl) {
        searchEl.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          const options = optionsEl.querySelectorAll('.dropdown-option');
          options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            opt.style.display = text.includes(term) ? 'flex' : 'none';
          });
        });
      }
    };

    setupCustomDropdown(this.elements.countryDropdown, this.elements.countrySearch, this.elements.countryOptions);
    setupCustomDropdown(this.elements.cityDropdown, null, this.elements.cityOptions);
    setupCustomDropdown(this.elements.yearDropdown, null, this.elements.yearOptions);

    // Year selection
    if (this.elements.yearOptions) {
      this.elements.yearOptions.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const val = opt.getAttribute('data-value');
          this.state.selectedYear = val;
          this.elements.yearSelect.value = val;
          this.elements.yearDropdown.querySelector('.selected-value span').textContent = val;
          this.elements.yearDropdown.classList.remove('active');
          
          this.elements.yearOptions.querySelectorAll('.dropdown-option').forEach(o => {
            o.classList.toggle('selected', o === opt);
          });

          this.updateUISelection();
        });
      });
    }

    // Close when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
    });

    // Clear Selection
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => {
        this.state.selectedCountry = '';
        this.state.selectedCity = '';
        this.elements.countrySelect.value = '';
        this.elements.citySelect.value = '';
        
        // Reset country dropdown UI
        const countryVal = document.getElementById('country-selected').querySelector('.selected-value');
        countryVal.innerHTML = '<i class="fa-solid fa-earth-americas placeholder-icon"></i><span>Select Country</span>';
        
        // Reset city dropdown UI
        const cityVal = document.getElementById('city-selected').querySelector('.selected-value');
        cityVal.innerHTML = '<i class="fa-solid fa-city placeholder-icon"></i><span>Select City</span>';
        this.elements.cityOptions.innerHTML = '';

        this.updateDashboard();
        this.updateUISelection();
        this.showToast('Selection cleared', 'info');
      });
    }

    // Clear All Plans
    const clearAllBtn = document.getElementById('clear-all-plans-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        Swal.fire({
          title: 'Are you sure?',
          text: "You won't be able to revert this!",
          icon: 'warning', 
          showCancelButton: true,
          confirmButtonColor: '#ff4d6d',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, clear all!'
        }).then((result) => {
          if (result.isConfirmed) {
            this.clearAllPlans();
            Swal.fire({
              title: 'Cleared!',
              text: 'Your plans have been deleted.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
          }
        });
      });
    }

    // Start Exploring Button
    const startBtn = document.getElementById('start-exploring-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.navigateTo('dashboard'));
    }

    // Browser back/forward buttons
    window.addEventListener('popstate', () => this.handleRouting());
  }

  setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('mobile-menu-btn');
    if (!sidebar || !overlay || !toggleBtn) return;

    let hideTimer = null;
    const transitionMs = 250;

    const isOpen = () => sidebar.classList.contains('open');

    const open = () => {
      if (hideTimer) clearTimeout(hideTimer);
      overlay.classList.remove('hidden');
      requestAnimationFrame(() => overlay.classList.add('active'));
      sidebar.classList.add('open');
    };

    const close = () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!overlay.classList.contains('active')) overlay.classList.add('hidden');
      }, transitionMs);
    };

    close();

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isOpen()) close();
      else open();
    });

    overlay.addEventListener('click', () => close());

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && isOpen()) close();
    });
  }

  navigateTo(viewName) {
    const url = viewName === 'dashboard' ? '/' : `/${viewName}`;
    window.history.pushState({ view: viewName }, '', url);
    this.showView(viewName);
  }

  handleRouting() {
    const path = window.location.pathname.replace('/', '') || 'dashboard';
    this.showView(path);
  }

  showView(viewName) {
    this.elements.navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    let found = false;
    this.elements.views.forEach(view => {
      const isActive = view.id === `${viewName}-view`;
      view.classList.toggle('active', isActive);
      if (isActive) found = true;
    });

    if (!found) {
      document.getElementById('dashboard-view').classList.add('active');
      viewName = 'dashboard';
    }

    this.elements.pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-', ' ');
    this.updateUISelection();
    this.loadViewData(viewName);
  }

  async loadCountries() {
    try {
      const [availableRes, restRes] = await Promise.all([
        fetch('https://date.nager.at/api/v3/AvailableCountries'),
        fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags,timezones,capital')
      ]);

      const availableCountries = await availableRes.json();
      const restCountries = await restRes.json();

      const restByCode = new Map(
        restCountries
          .filter(c => c && c.cca2)
          .map(c => [String(c.cca2).toUpperCase(), c])
      );

      let countries = availableCountries
        .filter(c => c && c.countryCode)
        .map((c) => {
          const code = String(c.countryCode).toUpperCase();
          const rest = restByCode.get(code);
          if (rest) return rest;
          return {
            cca2: code,
            name: { common: c.name || code },
            flags: { png: `https://flagcdn.com/w40/${code.toLowerCase()}.png` },
            timezones: ['UTC'],
            capital: []
          };
        });

      countries.sort((a, b) => a.name.common.localeCompare(b.name.common));
      this.countriesByCode = new Map(countries.map(c => [String(c.cca2).toUpperCase(), c]));

      this.elements.countryOptions.innerHTML = '';
      
      countries.forEach(country => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.setAttribute('data-value', country.cca2);
        
        option.innerHTML = `
          <img src="${country.flags.png}" alt="${country.name.common}" class="option-flag">
          <span class="option-name">${country.name.common}</span>
          <span class="option-code">${country.cca2}</span>
        `;

        option.addEventListener('click', () => {
          this.selectCountry(country);
        });

        this.elements.countryOptions.appendChild(option);
      });

      // Handle initial selection or default state
      if (this.state.selectedCountry) {
        const initial = countries.find(c => c.cca2 === this.state.selectedCountry);
        if (initial) this.selectCountry(initial, false);
      } else {
        this.updateDashboard();
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  }

  selectCountry(country, shouldUpdateCities = true) {
    this.state.selectedCountry = country.cca2;
    this.state.countryTimezone = country.timezones?.[0] || 'UTC';
    this.state.exploreClicked = false;
    this.elements.countrySelect.value = country.cca2;

    // Update UI
    const selectedVal = document.getElementById('country-selected').querySelector('.selected-value');
    selectedVal.innerHTML = `
      <img src="${country.flags.png}" alt="${country.name.common}">
      <span>${country.name.common}</span>
    `;

    this.elements.countryDropdown.classList.remove('active');

    this.elements.countryOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.toggle('selected', opt.getAttribute('data-value') === country.cca2);
    });

    if (shouldUpdateCities) {
      this.loadCities(country.cca2);
    }

    this.updateDestinationBar(country);
    this.updateUISelection();
  }

  updateDestinationBar(countryData) {
    const destinationBar = document.getElementById('selected-destination');
    if (!destinationBar) return;

    destinationBar.classList.remove('hidden');
    
    if (document.getElementById('selected-country-name')) {
      document.getElementById('selected-country-name').textContent = countryData.name.common;
    }
    if (document.getElementById('selected-city-name')) {
      document.getElementById('selected-city-name').textContent = this.state.selectedCity ? `• ${this.state.selectedCity}` : `• Capital: ${countryData.capital?.[0]}`;
    }
    if (document.getElementById('selected-country-flag')) {
      document.getElementById('selected-country-flag').src = countryData.flags.png;
      document.getElementById('selected-country-flag').alt = countryData.name.common;
    }
  }

  async loadCities(countryCode) {
    if (!countryCode) {
      this.elements.cityOptions.innerHTML = '';
      return;
    }

    try {
      const selectedCityVal = document.getElementById('city-selected').querySelector('.selected-value');
      if (selectedCityVal) {
        selectedCityVal.innerHTML = `
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Loading cities...</span>
        `;
      }
      this.elements.cityOptions.innerHTML = '<div class="dropdown-option loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>';
      
      const code = String(countryCode).toUpperCase();
      let countryData = this.countriesByCode?.get(code);
      if (!countryData) {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);
        const [fetched] = await countryRes.json();
        countryData = fetched;
      }
      const countryName = countryData?.name?.common || code;

      const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName })
      });
      const data = await response.json();
      
      this.elements.cityOptions.innerHTML = '';
      
      if (data.data && data.data.length > 0) {
        data.data.forEach(city => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.textContent = city;
          option.addEventListener('click', () => {
            this.selectCity(city);
          });
          this.elements.cityOptions.appendChild(option);
        });
        // Select first city by default
        this.selectCity(data.data[0]);
      } else {
        const capital = countryData.capital?.[0];
        if (capital) {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.textContent = `${capital} (Capital)`;
          option.addEventListener('click', () => {
            this.selectCity(capital);
          });
          this.elements.cityOptions.appendChild(option);
          this.selectCity(capital);
        }
      }
    } catch (error) {
      console.error('Error loading cities:', error);
      this.elements.cityOptions.innerHTML = '<div class="dropdown-option">Error loading cities</div>';
    }
  }

  selectCity(city) {
    this.state.selectedCity = city;
    this.elements.citySelect.value = city;

    const selectedVal = document.getElementById('city-selected').querySelector('.selected-value');
    selectedVal.innerHTML = `
      <i class="fa-solid fa-city"></i>
      <span>${city}</span>
    `;

    this.elements.cityDropdown.classList.remove('active');

    this.elements.cityOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.toggle('selected', opt.textContent === city);
    });

    if (this.state.selectedCountry) {
      const cityEl = document.getElementById('selected-city-name');
      if (cityEl) cityEl.textContent = `• ${city}`;
    }

    this.updateUISelection();
  }

  async loadViewData(viewName) {
    switch (viewName) {
      case 'dashboard': this.updateDashboard(); break;
      case 'holidays': this.loadHolidays(); break;
      case 'events': this.loadEvents(); break;
      case 'weather': this.loadWeather(); break;
      case 'long-weekends': this.loadLongWeekends(); break;
      case 'currency': this.loadCurrencyConverter(); break;
      case 'sun-times': this.loadSunTimes(); break;
      case 'my-plans': this.displayPlans(); break;
    }
  }

  toggleLoading(show) {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.toggle('hidden', !show);
    }
  }

  async updateDashboard() {
    const infoContent = document.getElementById('dashboard-country-info');
    const emptyState = document.getElementById('dashboard-empty-state');
    const destinationBar = document.getElementById('selected-destination');

    if (!this.state.selectedCountry || !this.state.exploreClicked) {
      if (infoContent) infoContent.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (!this.state.selectedCountry && destinationBar) destinationBar.classList.add('hidden');
      
      if (this.state.exploreClicked && !this.state.selectedCountry) {
        this.showToast('Please select a country first', 'error');
        this.state.exploreClicked = false;
      }
      return;
    }

    if (infoContent) infoContent.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (destinationBar) destinationBar.classList.remove('hidden');

    try {
      this.toggleLoading(true);
      const res = await fetch(`https://restcountries.com/v3.1/alpha/${this.state.selectedCountry}`);
      const [data] = await res.json();
      
      this.renderCountryInfo(data);
      this.updateStats(data);
      
      const cityName = this.state.selectedCity || data.capital?.[0] || 'Unknown City';
      this.showToast(`Exploring ${data.name.common}, ${cityName}!`, 'success');
    } catch (error) {
      console.error('Dashboard update error:', error);
    } finally {
      this.toggleLoading(false);
    }
  }

  async updateStats(countryData) {
    const statHolidays = document.getElementById('stat-holidays');
    if (statHolidays) {
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${this.state.selectedYear}/${this.state.selectedCountry}`);
        const holidays = await res.json();
        statHolidays.textContent = holidays.length;
      } catch (e) { statHolidays.textContent = '--'; }
    }
  }

  renderCountryInfo(data) {
    const container = document.getElementById('dashboard-country-info');
    if (!container) return;

    this.state.countryTimezone = data.timezones?.[0] || 'UTC';

    const currencies = Object.values(data.currencies || {}).map(c => `${c.name} (${c.symbol})`).join(', ');
    const languages = Object.values(data.languages || {}).join(', ');
    const borders = data.borders ? data.borders.map(b => `<span class="extra-tag border-tag">${b}</span>`).join('') : '<span class="extra-tag">None</span>';
    
    container.innerHTML = `
      <div class="dashboard-country-header">
        <img src="${data.flags.png}" alt="${data.name.common}" class="dashboard-country-flag">
        <div class="dashboard-country-title">
          <h3>${data.name.common}</h3>
          <p class="official-name">${data.name.official}</p>
          <span class="region"><i class="fa-solid fa-location-dot"></i> ${data.region} • ${data.subregion}</span>
        </div>
      </div>

      <div class="dashboard-local-time">
        <div class="local-time-display">
          <i class="fa-solid fa-clock"></i>
          <span class="local-time-value" id="country-local-time">--:--:-- --</span>
          <span class="local-time-zone">${this.state.countryTimezone}</span>
        </div>
      </div>

      <div class="dashboard-country-grid">
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-building-columns"></i>
          <span class="label">Capital</span>
          <span class="value">${data.capital?.[0] || 'N/A'}</span>
        </div>
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-users"></i>
          <span class="label">Population</span>
          <span class="value">${data.population.toLocaleString()}</span>
        </div>
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-ruler-combined"></i>
          <span class="label">Area</span>
          <span class="value">${data.area.toLocaleString()} km²</span>
        </div>
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-globe"></i>
          <span class="label">Continent</span>
          <span class="value">${data.continents?.[0] || 'N/A'}</span>
        </div>
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-phone"></i>
          <span class="label">Calling Code</span>
          <span class="value">${data.idd?.root || ''}${data.idd?.suffixes?.[0] || ''}</span>
        </div>
        <div class="dashboard-country-detail">
          <i class="fa-solid fa-car"></i>
          <span class="label">Driving Side</span>
          <span class="value" style="text-transform: capitalize;">${data.car?.side || 'N/A'}</span>
        </div>
      </div>

      <div class="dashboard-country-extras">
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-coins"></i> Currency</h4>
          <div class="extra-tags">
            <span class="extra-tag">${currencies}</span>
          </div>
        </div>
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-language"></i> Languages</h4>
          <div class="extra-tags">
            <span class="extra-tag">${languages}</span>
          </div>
        </div>
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-map-location-dot"></i> Neighbors</h4>
          <div class="extra-tags">
            ${borders}
          </div>
        </div>
      </div>

      <div class="dashboard-country-actions">
        <a href="https://www.google.com/maps/place/${encodeURIComponent(data.name.common)}" target="_blank" class="btn-map-link">
          <i class="fa-solid fa-map"></i> View on Google Maps
        </a>
      </div>
    `;

    this.updateDateTime();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const existingToasts = container.querySelectorAll('.toast');
    existingToasts.forEach(t => {
      if (t.querySelector('span')?.textContent === message) {
        t.remove();
      }
    });

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${message}</span>
      <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(toast);

    const timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(timeout);
      toast.remove();
    });
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
  }

  updateUISelection() {
    const countryCode = this.state.selectedCountry;
    const year = this.state.selectedYear;
    const city = this.state.selectedCity;
    const selectedCountryEl = document.querySelector('#country-selected .selected-value');
    const countryName = selectedCountryEl?.querySelector('span')?.textContent?.trim() || countryCode;
    const countryFlagSrc = selectedCountryEl?.querySelector('img')?.getAttribute('src') || (countryCode ? `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png` : '');

    document.querySelectorAll('.view-header-selection').forEach(container => {
      container.style.display = countryCode ? 'flex' : 'none';
    });

    if (!countryCode) return;

    document.querySelectorAll('.current-selection-badge').forEach(badge => {
      const flagImg = badge.querySelector('.selection-flag');
      const countrySpan = badge.querySelector('.selection-country');
      const yearSpan = badge.querySelector('.selection-year');
      const citySpan = badge.querySelector('.selection-city');

      if (flagImg) {
        flagImg.src = countryFlagSrc;
        flagImg.alt = countryName;
      }
      if (countrySpan) countrySpan.textContent = countryName;
      
      if (yearSpan) {
        yearSpan.textContent = year;
        yearSpan.style.display = '';
      }

      if (citySpan) {
        citySpan.textContent = city ? `• ${city}` : '';
        citySpan.style.display = city ? '' : 'none';
      }
    });
  }

  async loadHolidays() {
    const container = document.getElementById('holidays-content');
    if (!this.state.selectedCountry) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
          <h3>No Country Selected</h3>
          <p>Select a country from the dashboard to explore public holidays</p>
          <button class="btn-primary" onclick="app.navigateTo('dashboard')">
            <i class="fa-solid fa-earth-americas"></i> Go to Dashboard
          </button>
        </div>
      `;
      return;
    }

    this.updateUISelection();

    try {
      this.toggleLoading(true);
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${this.state.selectedYear}/${this.state.selectedCountry}`);
      const holidays = await res.json();
      
      container.innerHTML = holidays.map(h => `
        <div class="holiday-card">
          <div class="holiday-card-header">
            <div class="holiday-date-box">
              <span class="day">${h.date.split('-')[2]}</span>
              <span class="month">${new Date(h.date).toLocaleString('en', {month:'short'})}</span>
            </div>
            <button class="holiday-action-btn" onclick="app.savePlan({type:'Holiday', name:'${this.escapeHTML(h.localName)}', details:'${this.escapeHTML(h.name)}', date:'${h.date}'})">
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <h3>${h.localName}</h3>
          <p>${h.name}</p>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = 'Error loading holidays.';
    } finally {
      this.toggleLoading(false);
    }
  }

  getWeatherIcon(code) {
    if (code === 0) return 'fa-sun';
    if (code <= 3) return 'fa-cloud-sun';
    if (code <= 48) return 'fa-smog';
    if (code <= 67) return 'fa-cloud-showers-heavy';
    if (code <= 77) return 'fa-snowflake';
    if (code <= 82) return 'fa-cloud-rain';
    return 'fa-bolt-lightning';
  }

  getWeatherCondition(code) {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Rainy';
    return 'Stormy';
  }

  async loadWeather() {
    const container = document.getElementById('weather-content');
    if (!container) return;

    if (!this.state.selectedCity) {
      container.innerHTML = this.getEmptyStateHTML('cloud-sun', 'No City Selected', 'Select a city from the dashboard to view weather forecasts');
      return;
    }

    this.updateUISelection();
    this.toggleLoading(true);

    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.state.selectedCity)}&count=1&language=en&format=json`);
      const geoData = await geoRes.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        container.innerHTML = '<div class="error-state">City coordinates not found.</div>';
        return;
      }

      const { latitude, longitude } = geoData.results[0];

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
      const data = await res.json();

      const now = new Date();
      const currentDate = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
      const currentTime = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
      
      const forecastHTML = data.daily.time.map((date, index) => {
        const forecastDate = new Date(date);
        const isToday = index === 0;
        const dayName = forecastDate.toLocaleDateString('en', { weekday: 'short' });
        const dayDate = forecastDate.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        
        return `
          <div class="forecast-day ${isToday ? 'today' : ''}">
            <div class="forecast-day-name">
              <div class="day-label">${isToday ? 'TODAY' : dayName.toUpperCase()}</div>
              <div class="day-date">${isToday ? dayDate : ''}</div>
            </div>
            <div class="forecast-icon"><i class="fa-solid ${this.getWeatherIcon(data.daily.weather_code[index])}"></i></div>
            <div class="forecast-temps">
              <span class="temp-max">${Math.round(data.daily.temperature_2m_max[index])}°</span>
              <span class="temp-min">${Math.round(data.daily.temperature_2m_min[index])}°</span>
            </div>
          </div>
        `;
      }).join('');

      const detailsHTML = `
        <div class="weather-details-grid">
          <!-- Humidity -->
          <div class="weather-detail-card">
            <div class="detail-icon humidity"><i class="fa-solid fa-droplet"></i></div>
            <div class="detail-info">
              <div class="detail-label">Humidity</div>
              <div class="detail-value">${data.current.relative_humidity_2m}%</div>
              <div class="detail-bar">
                <div class="detail-bar-fill" style="width: ${data.current.relative_humidity_2m}%"></div>
              </div>
            </div>
          </div>
          
          <!-- Wind Speed -->
          <div class="weather-detail-card">
            <div class="detail-icon wind"><i class="fa-solid fa-wind"></i></div>
            <div class="detail-info">
              <div class="detail-label">Wind</div>
              <div class="detail-value">${data.current.wind_speed_10m} km/h</div>
              <div class="detail-extra">S</div>
            </div>
          </div>
          
          <!-- UV Index -->
          <div class="weather-detail-card">
            <div class="detail-icon uv"><i class="fa-solid fa-sun"></i></div>
            <div class="detail-info">
              <div class="detail-label">UV Index</div>
              <div class="detail-value">4</div>
              <div class="uv-level moderate">Moderate</div>
            </div>
          </div>
          
          <!-- Precipitation -->
          <div class="weather-detail-card">
            <div class="detail-icon precip"><i class="fa-solid fa-cloud-rain"></i></div>
            <div class="detail-info">
              <div class="detail-label">Precipitation</div>
              <div class="detail-value">0%</div>
              <div class="detail-extra">0mm expected</div>
            </div>
          </div>
          
          <!-- Sunrise/Sunset -->
          <div class="weather-detail-card sunrise-sunset">
            <div class="sun-times-visual">
              <div class="sun-time sunrise">
                <i class="fa-solid fa-sunrise"></i>
                <div class="sun-label">Sunrise</div>
                <div class="sun-value">06:46 AM</div>
              </div>
              <div class="sun-arc">
                <div class="sun-arc-path"></div>
                <div class="sun-position" style="--sun-progress: 30%"></div>
              </div>
              <div class="sun-time sunset">
                <i class="fa-solid fa-sunset"></i>
                <div class="sun-label">Sunset</div>
                <div class="sun-value">05:29 PM</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const hourlyHTML = `
        <div class="weather-section">
          <div class="weather-section-title">
            <i class="fa-solid fa-clock"></i>
            <span>Hourly Forecast</span>
          </div>
          <div class="hourly-scroll">
            ${data.hourly.time.slice(0, 24).map((time, index) => {
              const hourDate = new Date(time);
              const isNow = index === 0;
              const hour = hourDate.getHours();
              const hourLabel = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
              
              return `
                <div class="hourly-item ${isNow ? 'now' : ''}">
                  <div class="hourly-time">${isNow ? 'Now' : hourLabel}</div>
                  <div class="hourly-icon"><i class="fa-solid ${this.getWeatherIcon(data.hourly.weather_code[index])}"></i></div>
                  <div class="hourly-temp">${Math.round(data.hourly.temperature_2m[index])}°</div>
                  ${data.hourly.precipitation_probability[index] > 0 ? `<div class="hourly-precip"><i class="fa-solid fa-droplet"></i> ${data.hourly.precipitation_probability[index]}%</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      container.innerHTML = `
        <div class="weather-layout">
          <!-- Weather Hero Card -->
          <div class="weather-hero-card weather-cloudy">
            <div class="weather-hero-bg"></div>
            <div class="weather-hero-content">
              <div class="weather-location">
                <i class="fa-solid fa-location-dot"></i>
                <span>${this.state.selectedCity}</span>
                <span class="weather-time">${currentTime}</span>
              </div>
              <div class="weather-hero-main">
                <div class="weather-hero-left">
                  <div class="weather-hero-icon">
                    <i class="fa-solid ${this.getWeatherIcon(data.current.weather_code)}"></i>
                  </div>
                  <div class="weather-hero-temp">
                    <span class="temp-value">${Math.round(data.current.temperature_2m)}</span>
                    <span class="temp-unit">°C</span>
                  </div>
                </div>
                <div class="weather-hero-right">
                  <div class="weather-condition">${this.getWeatherCondition(data.current.weather_code)}</div>
                  <div class="weather-feels">Feels like 12°C</div>
                  <div class="weather-high-low">
                    <span class="high"><i class="fa-solid fa-arrow-up"></i> ${Math.round(data.daily.temperature_2m_max[0])}°</span>
                    <span class="low"><i class="fa-solid fa-arrow-down"></i> ${Math.round(data.daily.temperature_2m_min[0])}°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Weather Details Grid -->
          ${detailsHTML}

          <!-- Hourly Forecast -->
          ${hourlyHTML}

          <!-- 7-Day Forecast -->
          <div class="weather-section">
            <div class="weather-section-title">
              <i class="fa-solid fa-calendar-week"></i>
              <span>7-Day Forecast</span>
            </div>
            <div class="forecast-list">
              ${forecastHTML}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Weather error:', error);
      container.innerHTML = '<div class="error-state">Error loading weather data. Please try again.</div>';
    } finally {
      this.toggleLoading(false);
    }
  }

  async loadEvents() {
    const container = document.getElementById('events-content');
    if (!container) return;

    if (!this.state.selectedCity) {
      container.innerHTML = this.getEmptyStateHTML('ticket', 'No City Selected', 'Select a city from the dashboard to discover local events');
      return;
    }

    this.updateUISelection();
    this.toggleLoading(true);

    try {
      // API Key for Ticketmaster
      const apiKey = '7elSSTqcSZbS66WpA0775VqV876zX0xN';
      const city = encodeURIComponent(this.state.selectedCity);
      const country = this.state.selectedCountry;
      
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&city=${city}&countryCode=${country}&size=12`);
      const data = await res.json();
      
      const events = data._embedded?.events;
      if (!events) {
        this.showMockEvents(container);
        return;
      }

      container.innerHTML = events.map(event => this.createEventCardHTML(event)).join('');
    } catch (error) {
      this.showMockEvents(container);
    } finally {
      this.toggleLoading(false);
    }
  }

  createEventCardHTML(event) {
    const name = event.name;
    const venue = event._embedded?.venues?.[0]?.name || 'Local Venue';
    const date = event.dates.start.localDate;
    const img = event.images[0].url;
    const category = event.classifications?.[0]?.segment?.name || 'Event';
    const isSaved = this.state.plans.some(p => p.name === name && p.type === 'Event');

    return `
      <div class="event-card">
        <div class="event-card-image">
          <img src="${img}" alt="${name}">
          <span class="event-card-category">${category}</span>
          <button class="event-card-save ${isSaved ? 'saved' : ''}" 
                  onclick="app.savePlan({type:'Event', name:'${this.escapeHTML(name)}', details:'${this.escapeHTML(venue)}', date:'${date}'})">
            <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>
        <div class="event-card-body">
          <h3>${name}</h3>
          <div class="event-card-info">
            <div><i class="fa-regular fa-calendar"></i> ${date}</div>
            <div><i class="fa-solid fa-location-dot"></i> ${venue}</div>
          </div>
          <div class="event-card-footer">
            <a href="${event.url}" target="_blank" class="btn btn-primary btn-sm">Tickets</a>
          </div>
        </div>
      </div>
    `;
  }

  showMockEvents(container) {
    const city = this.state.selectedCity;
    const mocks = [
      { name: `${city} Summer Fest`, type: 'Festival', date: '2026-06-15', img: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400' },
      { name: `${city} Music Night`, type: 'Concert', date: '2026-07-20', img: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400' },
      { name: `${city} Tech Expo`, type: 'Exhibition', date: '2026-08-10', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' }
    ];

    container.innerHTML = mocks.map(m => {
      const isSaved = this.state.plans.some(p => p.name === m.name);
      return `
        <div class="event-card">
          <div class="event-card-image">
            <img src="${m.img}" alt="${m.name}">
            <span class="event-card-category">${m.type}</span>
            <button class="event-card-save ${isSaved ? 'saved' : ''}" 
                    onclick="app.savePlan({type:'Event', name:'${this.escapeHTML(m.name)}', details:'Local Venue', date:'${m.date}'})">
              <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
            </button>
          </div>
          <div class="event-card-body">
            <h3>${m.name}</h3>
            <div class="event-card-info">
              <div><i class="fa-regular fa-calendar"></i> ${m.date}</div>
              <div><i class="fa-solid fa-location-dot"></i> ${city} Center</div>
            </div>
            <div class="event-card-footer">
              <span class="mock-badge">Sample Event</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  getEmptyStateHTML(icon, title, text) {
    return `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-${icon}"></i></div>
        <h3>${title}</h3>
        <p>${text}</p>
        <button class="btn-primary" onclick="app.navigateTo('dashboard')">Go to Dashboard</button>
      </div>
    `;
  }

  async loadLongWeekends() {
    const container = document.getElementById('lw-content');
    if (!this.state.selectedCountry) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-calendar-days"></i></div>
          <h3>No Country Selected</h3>
          <p>Select a country from the dashboard to find long weekends</p>
          <button class="btn-primary" onclick="app.navigateTo('dashboard')">
            <i class="fa-solid fa-earth-americas"></i> Go to Dashboard
          </button>
        </div>
      `;
      return;
    }

    this.updateUISelection();

    try {
      this.toggleLoading(true);
      const res = await fetch(`https://date.nager.at/api/v3/LongWeekend/${this.state.selectedYear}/${this.state.selectedCountry}`);
      const weekends = await res.json();
      
      if (weekends.length === 0) {
        container.innerHTML = '<div class="no-selection">No long weekends found for this year.</div>';
        return;
      }

      container.innerHTML = weekends.map(w => `
        <div class="lw-card">
          <div class="lw-card-header">
            <span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${w.dayCount} Days</span>
            <button class="holiday-action-btn" onclick="app.savePlan({type:'Weekend', name:'Long Weekend', details:'${w.startDate} - ${w.endDate}', date:'${w.startDate}'})">
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <h3>Long Weekend</h3>
          <div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${w.startDate} to ${w.endDate}</div>
          <div class="lw-info-box ${w.needBridgeDay ? 'warning' : 'success'}">
            <i class="fa-solid ${w.needBridgeDay ? 'fa-circle-exclamation' : 'fa-check-circle'}"></i>
            ${w.needBridgeDay ? 'Bridge day might be needed' : 'No extra days off needed!'}
          </div>
        </div>
      `).join('');
    } catch (error) { 
      console.error(error); 
      container.innerHTML = 'Error loading long weekends.';
    } finally {
      this.toggleLoading(false);
    }
  }

  async loadCurrencyConverter() {
    const fromSelect = document.getElementById('currency-from');
    const toSelect = document.getElementById('currency-to');
    const swapBtn = document.getElementById('swap-currencies-btn');
    const convertBtn = document.getElementById('convert-btn');
    
    if (!fromSelect || !toSelect) return;

    try {
      this.toggleLoading(true);
      
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      this.rates = data.rates;
      
      const currencies = Object.keys(this.rates);
      
      const populate = (select, value) => {
        select.innerHTML = currencies.map(c => `<option value="${c}" ${c === value ? 'selected' : ''}>${c}</option>`).join('');
      };

      populate(fromSelect, fromSelect.value);
      
      if (this.state.selectedCountry && !this.state.currencyInitialized) {
        const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${this.state.selectedCountry}`);
        const [countryData] = await countryRes.json();
        const localCurrency = Object.keys(countryData.currencies || {})[0];
        
        if (localCurrency && this.rates[localCurrency]) {
          toSelect.value = localCurrency;
          this.state.currencyInitialized = true;
        }
      }
      populate(toSelect, toSelect.value);

      if (swapBtn) swapBtn.onclick = () => this.swapCurrencies();
      if (convertBtn) convertBtn.onclick = () => this.convertCurrency(true);

      this.updatePopularCurrencies();

    } catch (error) {
      console.error('Currency Error:', error);
    } finally {
      this.toggleLoading(false);
    }
  }

  updatePopularCurrencies() {
    const container = document.getElementById('popular-currencies');
    if (!container || !this.rates) return;

    const popular = ['EUR', 'GBP', 'EGP', 'AED', 'SAR', 'JPY', 'CAD', 'AUD'];
    
    container.innerHTML = popular.map(code => {
      // Calculate rate relative to current "From" currency (default USD if not set)
      const fromCurrency = document.getElementById('currency-from')?.value || 'USD';
      const rate = this.rates[code] / this.rates[fromCurrency];
      
      return `
        <div class="popular-currency-card" onclick="document.getElementById('currency-to').value='${code}'; app.convertCurrency();">
          <img src="https://flagcdn.com/w40/${this.getCountryCodeFromCurrency(code)}.png" alt="${code}" class="flag" onerror="this.src='https://flagcdn.com/w40/un.png'">
          <div class="info">
            <div class="code">${code}</div>
          </div>
          <div class="rate">${rate.toFixed(4)}</div>
        </div>
      `;
    }).join('');
  }

  getCountryCodeFromCurrency(currency) {
    const map = {
      'EUR': 'eu', 'GBP': 'gb', 'USD': 'us', 'EGP': 'eg', 'AED': 'ae', 'SAR': 'sa', 'JPY': 'jp', 'CAD': 'ca', 'AUD': 'au', 'CHF': 'ch', 'CNY': 'cn'
    };
    return map[currency] || currency.substring(0, 2).toLowerCase();
  }

  swapCurrencies() {
    const fromSelect = document.getElementById('currency-from');
    const toSelect = document.getElementById('currency-to');
    if (!fromSelect || !toSelect) return;

    const resultDiv = document.getElementById('currency-result');
    const shouldUpdateResult = !!resultDiv && resultDiv.style.display !== 'none';

    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;

    if (shouldUpdateResult) {
      this.convertCurrency(false);
    }
  }

  convertCurrency(showError = false) {
    if (!this.rates) return;

    const amountInput = document.getElementById('currency-amount');
    const amount = parseFloat(amountInput.value);
    const from = document.getElementById('currency-from').value;
    const to = document.getElementById('currency-to').value;
    const resultDiv = document.getElementById('currency-result');

    if (isNaN(amount) || amount <= 0) {
      if (showError) {
        this.showToast('Please fill in all fields', 'error');
      }
      resultDiv.style.display = 'none';
      return;
    }
    
    resultDiv.style.display = 'block';

    const result = (amount / this.rates[from]) * this.rates[to];
    const rate = this.rates[to] / this.rates[from];

    resultDiv.innerHTML = `
      <div class="conversion-display">
        <div class="conversion-from">
          <span class="amount">${amount.toLocaleString()}</span>
          <span class="currency-code">${from}</span>
        </div>
        <div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>
        <div class="conversion-to">
          <span class="amount">${result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="currency-code">${to}</span>
        </div>
      </div>
      <div class="exchange-rate-info">
        <p>1 ${from} = ${rate.toFixed(4)} ${to}</p>
        <small>Live rates via Open Exchange Rates</small>
      </div>
    `;
    
    this.updatePopularCurrencies();
  }

  async loadSunTimes() {
    const container = document.getElementById('sun-times-content');
    if (!this.state.selectedCity) {
      container.innerHTML = this.getEmptyStateHTML('sun', 'No City Selected', 'Select a city from the dashboard to see sunrise and sunset times');
      return;
    }

    try {
      this.toggleLoading(true);
      this.updateUISelection();

      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.state.selectedCity)}&count=1&language=en&format=json`);
      const geoData = await geoRes.json();
      
      if (!geoData.results?.length) {
        container.innerHTML = '<div class="error-state">City coordinates not found.</div>';
        return;
      }

      const { latitude, longitude } = geoData.results[0];

      const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=today&formatted=0`);
      const { results, status } = await res.json();
      
      if (status !== 'OK') throw new Error('Sun API error');

      const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      };

      const totalSeconds = results.day_length;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const dayPercent = ((totalSeconds / 86400) * 100).toFixed(1);
      
      const darknessSeconds = 86400 - totalSeconds;
      const darkHours = Math.floor(darknessSeconds / 3600);
      const darkMinutes = Math.floor((darknessSeconds % 3600) / 60);

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });

      container.innerHTML = `
        <div class="sun-main-card">
          <div class="sun-main-header">
            <div class="sun-location">
              <h2><i class="fa-solid fa-location-dot"></i> ${this.state.selectedCity}</h2>
              <p>Sun times for your selected location</p>
            </div>
            <div class="sun-date-display">
              <div class="date">${dateStr}</div>
              <div class="day">${dayStr}</div>
            </div>
          </div>
          
          <div class="sun-times-grid">
            ${this.createSunCardHTML('moon', 'DAWN', formatTime(results.civil_twilight_begin), 'Civil Twilight', 'dawn')}
            ${this.createSunCardHTML('sun', 'SUNRISE', formatTime(results.sunrise), 'Golden Hour Start', 'sunrise')}
            ${this.createSunCardHTML('sun', 'SOLAR NOON', formatTime(results.solar_noon), 'Sun at Highest', 'noon')}
            ${this.createSunCardHTML('sun', 'SUNSET', formatTime(results.sunset), 'Golden Hour End', 'sunset')}
            ${this.createSunCardHTML('moon', 'DUSK', formatTime(results.civil_twilight_end), 'Civil Twilight', 'dusk')}
            ${this.createSunCardHTML('hourglass-half', 'DAY LENGTH', `${hours}h ${minutes}m`, 'Total Daylight', 'daylight')}
          </div>
        </div>
        
        <div class="day-length-card">
          <div class="card-title">
            <i class="fa-solid fa-chart-pie"></i>
            <span>Daylight Distribution</span>
          </div>
          <div class="day-progress">
            <div class="day-progress-bar">
              <div class="day-progress-fill" style="width: ${dayPercent}%"></div>
            </div>
          </div>
          <div class="day-length-stats">
            <div class="day-stat">
              <div class="value">${hours}h ${minutes}m</div>
              <div class="label">Daylight</div>
            </div>
            <div class="day-stat">
              <div class="value">${dayPercent}%</div>
              <div class="label">of 24 Hours</div>
            </div>
            <div class="day-stat">
              <div class="value">${darkHours}h ${darkMinutes}m</div>
              <div class="label">Darkness</div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Sun times error:', error);
      container.innerHTML = '<div class="error-state">Error loading sun times. Please try again later.</div>';
    } finally {
      this.toggleLoading(false);
    }
  }

  createSunCardHTML(icon, label, time, subLabel, type) {
    return `
      <div class="sun-time-card">
        <div class="icon ${type}"><i class="fa-solid fa-${icon}"></i></div>
        <div class="label">${label}</div>
        <div class="time">${time}</div>
        <div class="sub-label">${subLabel}</div>
      </div>
    `;
  }

  updatePlansBadge() {
    const count = this.state.plans.length;
    if (this.elements.plansCount) {
      this.elements.plansCount.textContent = count;
      this.elements.plansCount.classList.toggle('hidden', count === 0);
    }
    const statSaved = document.getElementById('stat-saved');
    if (statSaved) statSaved.textContent = count;
  }

  savePlan(item) {
    const exists = this.state.plans.some(p => 
      p.type === item.type && 
      p.name === item.name && 
      p.date === item.date
    );

    if (exists) {
      this.showToast('Already saved!', 'info');
      return;
    }

    this.state.plans.push(item);
    localStorage.setItem('wanderlust_plans', JSON.stringify(this.state.plans));
    this.updatePlansBadge();
    this.showToast('Saved to My Plans!', 'success');
  }

  deletePlan(index) {
    Swal.fire({
      title: 'Remove Plan?',
      text: 'Are you sure you want to remove this plan?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff4d6d',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, remove it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.state.plans.splice(index, 1);
      localStorage.setItem('wanderlust_plans', JSON.stringify(this.state.plans));
      this.updatePlansBadge();
      this.displayPlans(this.state.currentPlansFilter || 'all');

      Swal.fire({
        title: 'Removed!',
        text: 'The plan has been removed.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    });
  }

  clearAllPlans() {
    this.state.plans = [];
    localStorage.removeItem('wanderlust_plans');
    this.updatePlansBadge();
    this.displayPlans(this.state.currentPlansFilter || 'all');
  }

  displayPlans(filter = 'all') {
    const container = document.getElementById('plans-content');
    if (!container) return;

    this.state.currentPlansFilter = filter;

    document.querySelectorAll('.plan-filter').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });

    const matchesFilter = (plan) => {
      if (filter === 'all') return true;
      if (filter === 'holiday') return plan.type === 'Holiday';
      if (filter === 'event') return plan.type === 'Event';
      if (filter === 'longweekend') return plan.type === 'Weekend' || plan.type === 'Long Weekend';
      return plan.type?.toLowerCase() === filter;
    };

    const filteredPlans = this.state.plans
      .map((plan, index) => ({ plan, index }))
      .filter(({ plan }) => matchesFilter(plan));

    this.updateFilterCounts();

    if (filteredPlans.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
          <h3>No ${filter === 'all' ? '' : filter} plans found</h3>
          <p>Start exploring and save something you like to see it here!</p>
          <button class="btn-primary" onclick="app.navigateTo('dashboard')">
            <i class="fa-solid fa-earth-americas"></i> Explore Now
          </button>
        </div>
      `;
      return;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const typeClass = (planType) => {
      if (planType === 'Holiday') return 'holiday';
      if (planType === 'Event') return 'event';
      return 'longweekend';
    };

    const typeLabel = (planType) => {
      if (planType === 'Weekend' || planType === 'Long Weekend') return 'Long Weekend';
      return planType;
    };

    const secondLine = (plan) => plan.details || plan.city || '';

    container.innerHTML = filteredPlans
      .map(({ plan: p, index }) => `
        <div class="plan-card">
          <span class="plan-card-type ${typeClass(p.type)}">${typeLabel(p.type)}</span>
          <div class="plan-card-content">
            <h4>${p.name}</h4>
            <div class="plan-card-details">
              ${p.date ? `<div><i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}</div>` : ''}
              ${secondLine(p) ? `<div><i class="fa-solid fa-tag"></i> ${secondLine(p)}</div>` : ''}
            </div>
            <div class="plan-card-actions">
              <button class="btn-plan-remove" onclick="app.deletePlan(${index})">
                <i class="fa-solid fa-trash"></i> Remove
              </button>
            </div>
          </div>
        </div>
      `).join('');
  }

  updateFilterCounts() {
    const counts = {
      all: this.state.plans.length,
      holiday: this.state.plans.filter(p => p.type === 'Holiday').length,
      event: this.state.plans.filter(p => p.type === 'Event').length,
      longweekend: this.state.plans.filter(p => p.type === 'Weekend' || p.type === 'Long Weekend').length
    };

    if (document.getElementById('filter-all-count')) document.getElementById('filter-all-count').textContent = counts.all;
    if (document.getElementById('filter-holiday-count')) document.getElementById('filter-holiday-count').textContent = counts.holiday;
    if (document.getElementById('filter-event-count')) document.getElementById('filter-event-count').textContent = counts.event;
    if (document.getElementById('filter-lw-count')) document.getElementById('filter-lw-count').textContent = counts.longweekend;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new WanderlustApp();
});
