# Rx Box: AI-Driven Smart Pillbox

**Project Status:** Ongoing  
**Project Type:** Capstone Project  
**Focus:** Internet of Things (IoT), Machine Learning, and Medication Adherence Monitoring

## 📌 About the Project

**Rx Box** is an AI-driven smart pillbox designed to support medication adherence among individuals with hypertension and diabetes. The system combines an IoT-enabled pillbox, mobile application, web-based monitoring interface, and predictive behavior analysis to help users monitor medication schedules and identify possible adherence risks.

The system detects medication compartment access, records medication activity as **Taken** or **Not Taken**, and provides reminders through physical alerts. It also analyzes medication-taking patterns to classify potential adherence risks and supports family notifications for selected medication-related concerns.

> **Note:** Compartment access is used as an indicator of medication activity and does not independently confirm that the medication was physically ingested.

## 🎯 Objectives

- Develop an ESP32-based smart pillbox integrated with a mobile application and web-based monitoring interface.
- Monitor medication compartment access and record medication adherence activity.
- Implement supervised machine learning for predictive behavior analysis and adherence risk classification.
- Provide medication reminders through buzzer, LED indicators, and application notifications.
- Monitor food-related questionnaire responses and classify dietary risk levels.
- Support family monitoring through adherence information and notifications for selected risks.
- Evaluate the prototype through unit, integration, and system testing.

## ✨ Key Features

- **Medication Reminders** — Provides scheduled alerts through the pillbox and application.
- **Compartment Monitoring** — Detects medication compartment access using sensors.
- **Adherence Tracking** — Records medication activity as Taken or Not Taken.
- **Predictive Behavior Analysis** — Analyzes adherence-related patterns and classifies potential risk levels.
- **Food Intake Monitoring** — Collects food-related questionnaire responses relevant to hypertension and diabetes management.
- **Family Notification Support** — Helps authorized family members stay informed about selected medication-related risks.
- **Cloud Database** — Centralizes medication schedules, adherence records, monitoring data, and notification records.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| ESP32 | Microcontroller for the smart pillbox |
| Compartment Sensors / Limit Switches | Detects compartment access |
| Buzzer and LED | Provides physical medication reminders |
| Wi-Fi | Enables device communication |
| MongoDB Atlas | Cloud-based database |
| Mobile Application | Medication scheduling, reminders, and adherence monitoring |
| Web Application | Family monitoring and viewing adherence information |
| Supervised Machine Learning | Predictive behavior analysis and risk classification |

*Technologies and features may be updated as development progresses.*

## 👥 Team Members and Responsibilities

| Team Member | Assigned Responsibility |
|---|---|
| **Ace Fronteras** | Frontend Development |
| **John Carl Layosa** | Backend Development |
| **Kristine Montajas** | Documentation |
| **Asher Tibayan** | Hardware Development |

## 📊 Current Status

**Ongoing Development**

The project is currently in development. The team is working toward integrating the smart pillbox hardware, application interfaces, centralized database, predictive behavior analysis, and notification features. Testing and evaluation will be conducted within the defined project scope.

## ⚠️ Scope and Limitations

- The project focuses on the design, development, integration, and controlled testing of a prototype.
- Medication compartment access does not guarantee that the user ingested the medication.
- Predictive risk classifications depend on the monitoring data available to the system.
- The system supports medication adherence monitoring and is not a substitute for professional medical advice, diagnosis, or treatment.
- Long-term clinical effectiveness is outside the scope of the current project.

## 🔮 Future Improvements

- Improve predictive analysis using additional validated adherence data.
- Enhance the mobile and web interfaces based on user feedback.
- Improve notification reliability and monitoring features.
- Expand testing and evaluation with appropriate participants and procedures.

## 📄 Disclaimer

Rx Box is an academic capstone project developed for educational and research purposes. It is intended to support medication adherence monitoring and risk awareness. It does not replace healthcare professionals or independently verify medication ingestion.

## 📚 Project Information

This project is developed as part of the team's academic capstone requirements. Its features and implementation may be updated as development and evaluation continue.
