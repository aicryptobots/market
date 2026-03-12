// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');
    const navRight = document.querySelector('.nav-right');
    
    if (mobileMenu) {
        mobileMenu.addEventListener('click', function() {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            navRight.style.display = navRight.style.display === 'flex' ? 'none' : 'flex';
            
            if (window.innerWidth <= 767) {
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '100%';
                navLinks.style.left = '0';
                navLinks.style.right = '0';
                navLinks.style.background = 'var(--dark)';
                navLinks.style.padding = '2rem';
                navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                
                navRight.style.position = 'absolute';
                navRight.style.top = 'calc(100% + 200px)';
                navRight.style.left = '0';
                navRight.style.right = '0';
                navRight.style.background = 'var(--dark)';
                navRight.style.padding = '2rem';
                navRight.style.justifyContent = 'center';
            }
        });
    }
    
    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
    
    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Navbar Background Change on Scroll
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(15, 23, 42, 0.95)';
        } else {
            navbar.style.background = 'rgba(15, 23, 42, 0.8)';
        }
    });
    
    // Animate Stats Counter
    const stats = document.querySelectorAll('.stat-number');
    
    const animateValue = (element, start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerHTML = Math.floor(progress * (end - start) + start) + (element.innerHTML.includes('%') ? '%' : '+');
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                // Animate stats if they're in view
                if (entry.target.classList.contains('stat-number')) {
                    const value = entry.target.innerText;
                    const numValue = parseInt(value);
                    if (!isNaN(numValue)) {
                        animateValue(entry.target, 0, numValue, 2000);
                    }
                }
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.feature-card, .guide-card, .stat-number').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
    
    // Live Data Simulation (for demo)
    if (window.location.pathname.includes('dashboard-demo')) {
        simulateLiveData();
    }
});

// Simulate Live Data for Demo
function simulateLiveData() {
    const priceElement = document.getElementById('live-price');
    const changeElement = document.getElementById('price-change');
    const signalElement = document.getElementById('ai-signal');
    
    if (priceElement && changeElement && signalElement) {
        setInterval(() => {
            // Random price movement
            const currentPrice = parseFloat(priceElement.innerText.replace('$', '').replace(',', ''));
            const change = (Math.random() * 2 - 1) * 100;
            const newPrice = currentPrice + change;
            
            priceElement.innerText = '$' + newPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            
            const percentChange = (change / currentPrice * 100).toFixed(2);
            changeElement.innerText = (percentChange > 0 ? '+' : '') + percentChange + '%';
            changeElement.className = percentChange > 0 ? 'green' : 'red';
            
            // Random signal
            const signals = ['BUY', 'SELL', 'NEUTRAL'];
            const confidences = ['92%', '87%', '75%', '68%', '95%'];
            const randomSignal = signals[Math.floor(Math.random() * signals.length)];
            const randomConfidence = confidences[Math.floor(Math.random() * confidences.length)];
            
            signalElement.innerHTML = `${randomSignal} <span class="confidence">${randomConfidence}</span>`;
            signalElement.className = randomSignal.toLowerCase();
        }, 5000);
    }
}

// Copy to Clipboard Function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Code copied to clipboard!');
    }).catch(() => {
        alert('Failed to copy code');
    });
}

// Demo Login Function
function demoLogin() {
    const code = document.getElementById('demo-code').value;
    if (code && code.length === 6) {
        window.location.href = 'dashboard-demo.html?code=' + code;
    } else {
        alert('Please enter a valid 6-digit code');
    }
}