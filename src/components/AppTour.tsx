import React, { useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';

const AppTour: React.FC = () => {
  const { showTour, setShowTour, user, settings, customers } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = React.useState(0);

  const steps: Step[] = React.useMemo(() => [
    {
      target: 'body',
      content: 'Welcome to MilkBook! Let\'s set up your dairy business in 2 minutes.',
      placement: 'center',
    },
    {
      target: '#tour-business-name',
      content: 'Step 1 (Mandatory): Enter your Business Name. This will be shown on all customer bills.',
      disableBeacon: true,
      spotlightClicks: true,
    },
    {
      target: '#tour-business-address',
      content: 'Step 2 (Mandatory): Enter your Office/Farm Address. This will appear on your customer receipts.',
      spotlightClicks: true,
    },
    {
      target: '#tour-upi-id',
      content: 'Step 3 (Mandatory): Add your UPI ID (e.g., yourname@okaxis). We will generate a QR code for your customers automatically!',
      spotlightClicks: true,
    },
    {
      target: '#tour-milk-rate',
      content: 'Step 4 (Mandatory): Set your Milk Rate per Litre. This is your default selling price.',
      spotlightClicks: true,
    },
    {
      target: '#tour-add-customer',
      content: 'Step 5 (Mandatory): Time to add your members! Please enter their 10-digit Indian phone number and name. Add at least 2 customers now.',
      spotlightClicks: true,
    },
    {
      target: '#tour-session-toggle',
      content: 'Step 6: On the Delivery page, you can toggle between Morning and Evening milk distribution.',
    },
    {
      target: '#tour-delivery-item',
      content: 'Step 7: Simply adjust the liters for each member. Your data is synced to the cloud instantly!',
    },
    {
      target: '#tour-report-summary',
      content: 'Step 8: View your monthly collection summary and outstanding balances here.',
    },
    {
      target: '#tour-report-item',
      content: 'Step 9: Click on a customer to view their statement and record payments. Next, let\'s check out Digital Bills!',
    },
    {
      target: 'body',
      content: 'Step 10: In the Digital Bills section, you can manage all monthly member statements in one place.',
      placement: 'center',
    },
    {
      target: '#tour-whatsapp-btn',
      content: 'Step 11: Instantly send a professional summary to your customer via WhatsApp!',
    },
    {
      target: '#tour-download-btn',
      content: 'Step 12: Or download a beautiful PDF report with your business name and QR code for printing. Your tour is now complete!',
    },
  ], []);

  const handleJoyrideCallback = React.useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    if (type === 'step:after') {
      // VALIDATION LOGIC
      if (action === 'next') {
        if (index === 1 && !settings.businessName) {
          alert('Please enter your Business Name before proceeding.');
          setStepIndex(1);
          return;
        }
        if (index === 2 && !settings.address) {
          alert('Please enter your Business Address before proceeding.');
          setStepIndex(2);
          return;
        }
        if (index === 3 && !settings.upiId) {
          alert('Please enter your UPI ID for QR payments.');
          setStepIndex(3);
          return;
        }
        if (index === 4 && !settings.rate) {
          alert('Please set your Milk Rate.');
          setStepIndex(4);
          return;
        }
        if (index === 5 && customers.length < 2) {
          alert(`Please add at least 2 customers. You currently have ${customers.length}.`);
          setStepIndex(5);
          return;
        }
      }

      const nextIndex = index + (action === 'prev' ? -1 : 1);
      
      if (nextIndex >= 1 && nextIndex <= 4) {
        if (location.pathname !== '/settings') navigate('/settings');
      } else if (nextIndex === 5) {
        if (location.pathname !== '/customers') navigate('/customers');
      } else if (nextIndex >= 6 && nextIndex <= 7) {
        if (location.pathname !== '/') navigate('/');
      } else if (nextIndex >= 8 && nextIndex <= 9) {
        if (location.pathname !== '/reports') navigate('/reports');
      } else if (nextIndex >= 10 && nextIndex <= 12) {
        if (location.pathname !== '/bills') navigate('/bills');
      }
      
      setStepIndex(nextIndex);
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      if (customers.length < 2 || !settings.upiId || !settings.businessName || !settings.address) {
         alert("You must complete all required fields and add at least 2 customers before starting.");
         setShowTour(true);
         setStepIndex(1);
         return;
      }
      setShowTour(false);
      if (user) {
         localStorage.setItem(`tour_seen_${user.uid}`, 'true');
      }
    }
  }, [user, location.pathname, navigate, setShowTour, settings, customers]);

  // Sync stepIndex if user manually navigates? 
  // No, let Joyride control it.

  return (
    <Joyride
      steps={steps}
      run={showTour}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      disableScrolling={false}
      disableOverlayClose={true}
      disableCloseOnEsc={true}
      hideCloseButton={true}
      styles={{
        options: {
          primaryColor: '#1e1b4b',
          zIndex: 1000,
        },
        buttonNext: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: '#1e1b4b',
        },
        buttonBack: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginRight: '10px',
          color: '#64748b',
        },
        buttonSkip: {
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          color: '#94a3b8',
        },
        tooltip: {
          borderRadius: '16px',
          padding: '20px',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#1e1b4b',
        },
        tooltipContent: {
          fontSize: '13px',
          color: '#64748b',
          padding: '10px 0',
        }
      }}
    />
  );
};

export default AppTour;
