# Golden set run

- Mode: `retrieval`
- Started: 2026-09-17T06:26:20.508217+00:00
- Workspace: Real Document Eval
- Corpus: 10 documents, 424 passages
- Answer model configured: `gemini-3.5-flash`

Fill in `grading` in the JSON file: `answer_correct` as `true`, `false` or `"partial"`, and `citation_acceptable` as `true` only when the model cited a different passage that genuinely supports the answer.

---

## Q01 · paraphrased_lookup · `lookup`

**Q.** How well does the custom-built neural network spot tea leaf diseases, compared with the transfer-learning model used in the same study?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 15
> overall accuracy of 94% in classifying tea leaf diseases

**Expected answer.** The custom CNN built from scratch reached 94% overall accuracy, beating the ResNet50V2 transfer-learning model in the same study, which reached 84% accuracy.

**Retrieved** (5 passages), expected at rank **1**

1. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > information on the screen by displaying the disease name, MobileNetV2. Additionally, the impact of different optimizers reasons, symptoms, and remedies. (Adam, RMSprop, Adamax) and data augmentation techniques was also investigated, and among the optimizers, Adamax VI. RESULTS AND DISCUSSION demonst

2. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |leaf diseases|in the literat|ure. With the|help of|Convolutional<br>|disease remed|ie|s, it would be|a great oppo|rtunit|y for farmers| |Neural Netw|orks (CNN),|proposed|a disease|classiﬁcation<br>|to get notiﬁed|a|bout their cul|tivation using|their|smartphones.| |model [7], a|nd it recorde|d 84.5

3. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |142 images each and|the healthy class|contain|ing around 80<br>|learn faster and|achieve better|ov|erall perf|ormance. Max| |images. The dataset e|ncompasses eight|distinct t|ea leaf disease<br>|pooling layers a|re used to reduc|e th|e spatial|dimensionality| |classes, including th|e healthy class.

4. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > ||<br>|<br>|<br>|[9]|V.<br>Tanwar<br>and<br>S.<br>Lamba,<br>“Tea<br>Leaf<br>Diseases<br>Classi|cation| |a<br>|custom CNN <br>|model a<br>|tained an impressive 94% accuracy,<br>||and Detection using a Convolutional Neural Network,” in|_2023_| |d|emonstrating th|e effecti|veness of the proposed approa

5. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |o|of accuracy but|t also ex|xcels in classifying a larger number|Col5|Col6|Col7| |---|---|---|---|---|---|---| |o|f accuracy but|also ex|cels in classifying a larger number|[6]|C.-C.<br>Yang,<br>S.<br>O.<br>Prasher,<br>P.<br>Enright,<br>C.<br>Madram|ootoo,| |o|f tea leaf disea|se class|es, thereby

---

## Q02 · paraphrased_lookup · `lookup`

**Q.** How does PowerProx decide what each person using the system is allowed to do?

**Expected passage.** SLT_PowerProx_solution_architecture.docx, passage 17
> PowerProx uses a Role-Based Access Control (RBAC) approach to manage user permissions. Each user is assigned an access level or role that determines the modules, functions, and actions available to that user.

**Expected answer.** Through Role-Based Access Control (RBAC): every user is assigned an access level or role (e.g. Administrator, Engineer/Technical User, Technician, Approving Officer/Manager, Viewer/Read-Only User) and that role determines which modules, functions and actions they can use.

**Retrieved** (5 passages), expected at rank **not retrieved**

1. `SLT PowerProx solution architecture.docx` System Architecture > Logical Modules (score None)
   > | Logical Module | Architectural Responsibility | | --- | --- | | Generator Management | Supports generator asset information, inspections, operational records, supplier information, and generator-specific maintenance activities. | | Other Asset Management | Supports common asset management function

2. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 3. ROLE(S) AND ACTIVITIES (score None)
   > During my internship at SLT Telecom, I contributed to four significant projects, showcasing my versatility and technical capabilities. 1. PowerProx (Power at Your Fingertips) As my main project, I developed various features for this mobile application designed to manage power assets and employees i

3. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Use case descriptions > Use Case 2: Get Dental Issue Prediction > Primary Actor: System Description: The system analyzes the dental X-ray image using the (score None)
   > on-device deep learning model and provides detection results with bounding boxes for dental issues. Preconditions: Dental X-ray image has been captured or uploaded.. Main Flow: 1.​ System preprocesses the image (resize, normalize, etc.) 2.​ System runs the on-device TensorFlow Lite model for inferen

4. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR2: X-ray Image Acquisition (score None)
   > ●​ FR2.1: The system shall allow users to capture X-ray images using the device camera ●​ FR2.2: The system shall allow users to upload existing X-ray images from device storage ●​ FR2.3: The system shall verify that uploaded images meet minimum quality requirements ●​ FR2.4: The system shall provid

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |What is expected of me in this assessment?<br>(c) Evaluate the effectiveness of these tokenization schemes by analyzing their impact on corpus statistics<br>(total words, unique words) and recommend the most suitable tokenization scheme for subsequent<br>LLM tasks, using the perplexity metric based

---

## Q03 · paraphrased_lookup · `lookup`

**Q.** In the SmartSmile app, how long does the phone have to come back with a result after someone scans an X-ray?

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 17
> FR3.5: The system shall complete inference within 5 seconds on target devices.

**Expected answer.** Within 5 seconds.

**Retrieved** (5 passages), expected at rank **2**

1. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Use case descriptions > Use Case 1: Capture/Upload X-ray Image > Primary Actor: Patient/Healthcare Worker Description: The user captures a new chest X-ray (score None)
   > image using the device camera or uploads an existing X-ray image from the device storage. Preconditions: User has launched the mobile application and is authenticated. Main Flow: 1.​ User selects "New Scan" option in the application 2.​ User chooses between camera capture or gallery upload 3.​ If ca

2. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR3: On-Device Inference (score None)
   > ●​ FR3.1: The system shall perform preprocessing of dental X-ray images for model compatibility. ●​ FR3.2: The system shall execute the dental scan detection model (YOLOv10) locally on the device. ●​ FR3.3: The system shall generate bounding boxes around detected dental issues within the X-ray image

3. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Use case descriptions > Use Case 2: Get Dental Issue Prediction > Primary Actor: System Description: The system analyzes the dental X-ray image using the (score None)
   > on-device deep learning model and provides detection results with bounding boxes for dental issues. Preconditions: Dental X-ray image has been captured or uploaded.. Main Flow: 1.​ System preprocesses the image (resize, normalize, etc.) 2.​ System runs the on-device TensorFlow Lite model for inferen

4. `Group 27 - report - SmartSmile edgeAI.pdf` Introduction > Problem Statement (score None)
   > Currently, dental tourists have no way to get an initial understanding of their dental health before visiting a clinic overseas. While OPG X-rays are an effective tool for early diagnosis, there is no streamlined system to analyze these images remotely. As a result, travelers are left to plan their

5. `Group 27 - report - SmartSmile edgeAI.pdf` Introduction > Aim of the Project (score None)
   > The aim of this project is to build a mobile application that allows users to upload their OPG X-rays and receive a basic AI-powered diagnosis using YOLOv10 object detection. Initially, the model will identify 9 dental conditions, helping users estimate how urgently they need treatment and plan thei

---

## Q04 · exact_term · `lookup`

**Q.** What is the name of the API endpoint that handles CV ranking requests in the CV Filtering System?

**Expected passage.** CV_Filtering_System_AI_.docx, passage 0
> API Endpoint (/rank_cvs) Receives filtering request with custom prompt

**Expected answer.** /rank_cvs

**Retrieved** (5 passages), expected at rank **1**

1. `CV Filtering System AI .docx`  (score None)
   > CV Filtering System: Step-by-Step Process CV filtering system is designed to rank candidate CVs based on their relevance to a specific job requirement prompt. Overall Process Flow CV Processing & Storage PDFs are converted to images OCR extracts text from images Extracted text is stored in dat

2. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR5: Expert Review Interface (score None)
   > ●​ FR5.1: The system shall provide doctors with a queue of cases requiring review ●​ FR5.2: The system shall display the original X-ray alongside the model prediction ●​ FR5.3: The system shall allow doctors to input their diagnostic assessment ●​ FR5.4: The system shall support adding annotations t

3. `Group 27 - report - SmartSmile edgeAI.pdf` References (score None)
   > Ultralytics. (n.d.). Train. [Online] Available at: https://docs.ultralytics.com/modes/train/#usage-examples [Accessed 23 March 2025]. Ultralytics. (n.d.). Export. [Online] Available at: https://docs.ultralytics.com/modes/export/ [Accessed 7 April 2025]. Rizhko, G. (2023). Plastic Waste Classificatio

4. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 3. ROLE(S) AND ACTIVITIES (score None)
   > During my internship at SLT Telecom, I contributed to four significant projects, showcasing my versatility and technical capabilities. 1. PowerProx (Power at Your Fingertips) As my main project, I developed various features for this mobile application designed to manage power assets and employees i

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |**Task(s) - content**<br>_10 years ago, there was an article1 stating that the r/srilanka subreddit on the Reddit platform was not a_<br>_natural choice for Sri Lankans until 2013 or so, when the number subscribing went past 1000.

---

## Q05 · exact_term · `lookup`

**Q.** Which port number does MySQL use in Server B's firewall rule in the SLT server migration proposal?

**Expected passage.** SLT_Server_Migration_Proposal.docx, passage 14
> Server B (database tier) is firewalled to accept traffic only from Server A, and only on database ports (5432 for PostgreSQL, 3306 for MySQL)

**Expected answer.** 3306

**Retrieved** (5 passages), expected at rank **1**

1. `SLT_Server_Migration_Proposal.docx` 7. Security Considerations (score None)
   > Server B (database tier) is firewalled to accept traffic only from Server A, and only on database ports (5432 for PostgreSQL, 3306 for MySQL) SSL/TLS termination handled at Nginx on Server A Environment variables / connection strings kept out of source control and managed via a secrets file or env

2. `SLT_Server_Migration_Proposal.docx` 1. Executive Summary (score None)
   > This proposal outlines the architecture and plan for migrating the current application and database servers hosted at the IDC (Internet Data Center) to the company's new IT data center. The migration covers 5 frontend applications (PowerProx Web, PowerZenith, SLT Solar Dashboard, Admin Overview Dash

3. `SLT_Server_Migration_Proposal.docx` 6. Migration Strategy and Order > 6.1 Database Migration Approach (score None)
   > Two options are available for the database cutover, offering a trade-off between simplicity and downtime: Dump & restore (pg_dump / mysqldump): simplest approach, requires a scheduled maintenance window (e.g. overnight) for the final cutover Replication (streaming replication for Postgres, native

4. `SLT_Server_Migration_Proposal.docx` 2. Current State (IDC) (score None)
   > | Component | Type | Notes | | --- | --- | --- | | PowerProx Web | Flutter — static frontend | Served as static build output | | PowerZenith | React — static frontend | Served as static build output | | SLT Solar Dashboard | React — static frontend | Served as static build output | | Admin Overview

5. `SLT_Server_Migration_Proposal.docx` 4. Target Architecture > 4.1 Server A — Web / Application Tier (score None)
   > Nginx — reverse proxy, SSL termination, and static file server for PowerProx Web, PowerZenith, SLT Solar Dashboard, Admin Overview Dashboard, and SLT Fault Logging System 3 FastAPI backends (PowerProx, PowerZenith, Solar Dashboard), each running in its own Docker container on a separate internal po

---

## Q06 · table · `lookup`

**Q.** In the GreenGuard classification report (Table I), what F1-score and support count did the 'Gray light' disease class get?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 12
> Gray light 0.96 1.00 0.98 23

**Expected answer.** F1-score 0.98, with a support (sample count) of 23.

**Retrieved** (5 passages), expected at rank **4**

1. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |Author|Dataset|Number<br>of<br>disease<br>classes|Method|Accuracy Metrics|Accuracy| |---|---|---|---|---|---| |Singh et al. [7]|900 high resolution im-<br>ages|7|Convolutional 2D model|Precision,<br>Recall,<br>F1-<br>score|Classiﬁcation<br>accuracy-<br>84.5%| |Divya Praba et al.<br>[8]|UAV dataset|

2. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > information on the screen by displaying the disease name, MobileNetV2. Additionally, the impact of different optimizers reasons, symptoms, and remedies. (Adam, RMSprop, Adamax) and data augmentation techniques was also investigated, and among the optimizers, Adamax VI. RESULTS AND DISCUSSION demonst

3. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |142 images each and|the healthy class|contain|ing around 80<br>|learn faster and|achieve better|ov|erall perf|ormance. Max| |images. The dataset e|ncompasses eight|distinct t|ea leaf disease<br>|pooling layers a|re used to reduc|e th|e spatial|dimensionality| |classes, including th|e healthy class.

4. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |Col1|Precision|Recall|F1-score|Support| |---|---|---|---|---| |Anthracnose|0.94|0.79|0.86|19| |Algal leaf|1.00|0.94|0.97|17| |Bird eye spot|0.81|0.93|0.87|14| |Brown blight|0.93|0.93|0.93|15| |Gray light|0.96|1.00|0.98|23| |Red leaf spot|1.00|0.93|0.97|15| |White spot|0.90|1.00|0.95|19| |Healthy|1.

5. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |178|**system that can accurately identify ail**<br>|** ments and sug**<br>|** gest relevant**<br>|climate due to global|arming, ba|cteria|infections|from some| |5-|**treatments. The proposed Convolutio**|**nal Neural Net**|**work (CNN)**|<br>other plants, and lack o|<br> f fertilizers.

---

## Q07 · table · `lookup`

**Q.** How much RAM is proposed for Server B (the database server) in the starting sizing allocation of the SLT server migration proposal?

**Expected passage.** SLT_Server_Migration_Proposal.docx, passage 9
> | Server B (Database) | 2 | 4-8 GB | SSD (priority) | Postgres + MySQL, separate data volumes if possible |

**Expected answer.** 4-8 GB.

**Retrieved** (5 passages), expected at rank **1**

1. `SLT_Server_Migration_Proposal.docx` 5. Server Sizing (Starting Allocation) (score None)
   > | Server | vCPU | RAM | Storage | Notes | | --- | --- | --- | --- | --- | | Server A (Web/App) | 2 | 4 GB | Standard SSD | Static files + 3 lightweight FastAPI containers | | Server B (Database) | 2 | 4–8 GB | SSD (priority) | Postgres + MySQL, separate data volumes if possible |

2. `SLT_Server_Migration_Proposal.docx` 10. Conclusion (score None)
   > This proposal favors a lean, phased approach: a two-server split that keeps databases isolated from the application tier, a migration order that de-risks the process by tackling the lowest-risk components first, and a starting sizing allocation that avoids over-provisioning while leaving a clear pat

3. `SLT_Server_Migration_Proposal.docx` 5. Server Sizing (Starting Allocation) (score None)
   > | Recommendation: start at the sizing above, monitor CPU/RAM utilization for 2–4 weeks post-migration, and scale up only if sustained utilization exceeds ~70%. | | --- |

4. `SLT_Server_Migration_Proposal.docx` 5. Server Sizing (Starting Allocation) (score None)
   > Sizing is proposed as a lean starting point with room to scale, rather than a large upfront request. This avoids over-provisioning while giving a clear trigger point for when to request more resources.

5. `SLT_Server_Migration_Proposal.docx` 4. Target Architecture > 4.2 Server B — Database Tier (score None)
   > PostgreSQL and MySQL, each with memory limits configured so neither starves the other under load No internet-facing access — only reachable from Server A, and only on database ports SSD-backed storage prioritized over CPU/RAM, since disk I/O is the more common bottleneck for databases at this scal

---

## Q08 · multi_passage · `explore`

**Q.** In CM4607, which fitness-function component was given the highest weight, and does the GA's actual final result reflect that priority?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 39, 68
> w1 = 100 (High): Primary objective. Waiting time directly impacts user experience and is the most critical metric in traffic engineering.

**Expected answer.** Average waiting time (Wavg) has the highest weight, w1 = 100, described as the 'Primary objective' in the weight-justification section. The final result reflects that priority: the GA achieved a 51.3% reduction in average waiting time, and the discussion explicitly accepts a slightly worse maximum queue (14 to 15 vehicles) as 'an acceptable trade-off' for that waiting-time gain.

**Retrieved** (4 passages), expected at rank **1**

1. `CM4607 Esandu Report.pdf` Methodology > Fitness Function > Weight Justification (score None)
   > The weight coefficients were selected based on traffic engineering priorities: • w1 = 100 (High): Primary objective. Waiting time directly impacts user experience and is the most critical metric in traffic engineering. • w2 = 20 (Medium): Secondary indicator. Queue length correlates with delay but a

2. `CM4607 Esandu Report.pdf` Results and Discussion > Analysis and Discussion > Multi-Objective Balance: The GA successfully balanced competing objectives, prior- (score None)
   > itizing average metrics over worst-case (maximum queue increased marginally from 14 to 15 vehicles, an acceptable trade-off given the 51% improvement in average waiting time).

3. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |_based on the template given, where RGUID should be replaced by your RGU ID number. For each such part,_<br>_a descriptive summary with an interpretation of the output should be given each executable cell. You also_<br>_need to su

4. `CM4607 Esandu Report.pdf` Results and Discussion > Analysis and Discussion > Conclusion: While both Q-Learning (computational intelligence via RL) and GA (computa- (score None)
   > tional intelligence via EA) improved significantly over the analytical baseline, GA’s populationbased evolutionary search proved more effective for this discrete, expensive-evaluation, black-box optimization problem.

---

## Q09 · multi_passage · `explore`

**Q.** Of the 250 posts used as the manually annotated sentiment test set in the NLP coursework report, how many did Esandu actually label himself versus have an LLM label?

**Expected passage.** NLP_CWReport_2237041.pdf, passage 6, 9
> I randomly selected 250 posts for manual annotation as the test set.

**Expected answer.** He personally annotated 50 of the 250 posts, then had Gemini label the other 200 after checking that Gemini's labels matched his own 50.

**Retrieved** (6 passages), expected at rank **3**

1. `NLP_CWReport_2237041.pdf` Natural Language Processing > Coursework Report > Part A: Reflective Report On Learning Process > Task 5 > Task 5b - Few-Shot Sentiment Classification: I compared the Task 5a proxy labels (score None)
   > against RoBERTa zero-shot and few-shot approaches. Using the 250 manually annotated posts, I implemented few-shot and zero shot prompting with 2 examples per class, achieving F1=0.6506 on the manual test set for zero shot prompting. Task 5c - Custom Sentiment Classifier Training: I trained classifie

2. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |**Task(s) - content**<br>_10 years ago, there was an article1 stating that the r/srilanka subreddit on the Reddit platform was not a_<br>_natural choice for Sri Lankans until 2013 or so, when the number subscribing went past 1000.

3. `NLP_CWReport_2237041.pdf` Natural Language Processing > Coursework Report > Part A: Reflective Report On Learning Process > Task 5 > Task 5a - Proxy Ground Truth Establishment: I filtered education-related posts (score None)
   > using my NMF topic model, then established proxy ground truth using ensemble voting across three methods: (1) VADER (lexicon-based), (2) DistilBERT fine-tuned on SST-2, and (3) RoBERTa Twitter sentiment. I randomly selected 250 posts for manual annotation as the test set.

4. `NLP_CWReport_2237041.pdf` Natural Language Processing > Coursework Report > Part A: Reflective Report On Learning Process > Task 1 (score None)
   > I initially collected 49000 text entries (includes posts, comments) from r/srilanka using the Reddit API (PRAW), implementing a multi-method approach combining hot, new, top, and rising post collection with keyword-based search across 200 Sri Lankan topics. But as I proceeded Task 3 and 4, I realize

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Feedback grid > Date created: August 2023 (score None)
   > |GRADE|A|B|C|D|E|F| |---|---|---|---|---|---|---| |**DEFINITION /**<br>**CRITERIA**<br>**(WEIGHTING)**|**EXCELLENT**<br>Outstanding<br>Performance|**COMMENDABLE/VERY GOOD**<br>Meritorious<br>Performance|<br>**GOOD**<br>Highly Competent<br>Performance|**SATISFACTORY**<br>Competent<br>Performance|**BO

---

## Q10 · cross_doc · `explore`

**Q.** Esandu's individual CM4607 report says the GA achieved a 51.3% reduction in average waiting time versus baseline. How does that compare to the improvement DQN achieved over fixed-time control in the medium-traffic scenario reviewed in the group's RL literature review (rt-grp-1-report)?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 65, 78
> 51.3% reduction in average waiting time

**Expected answer.** They are in the same ballpark: CM4607's own GA cut average waiting time by 51.3% versus baseline. In the group report's review of Mousavi et al.'s medium-traffic scenario (Table 4), DQN and DDPG achieved a 47-49% reduction in waiting time versus fixed-time control (94.8s/91.5s vs a 180.2s baseline). So Esandu's own GA result slightly exceeds the DQN figure reported in the literature review.

**Retrieved** (6 passages), expected at rank **1**

1. `rt-grp-1-report.pdf` Automated Traffic Signal Control > Detailed Analysis of Selected Papers > Function-Based Reinforcement Learning > 3,720 (score None)
   > Key Findings: 1. Substantial improvement over conventional methods: DQN and DDPG achieve 4749% reduction in waiting time versus fixed-time control and 35-37% versus actuated control, demonstrating deep RL’s effectiveness for adaptive policies. 2. DDPG marginally outperforms DQN: DDPG achieves 3.5% l

2. `rt-grp-1-report.pdf` Automated Traffic Signal Control > Control > Comprehensive Literature Classification > used (score None)
   > |Era|Year|Authors|Method|Venue/Citation|Key Contribution| |---|---|---|---|---|---| |Classic|1994|Mikami and Kakazu (1994)|Genetic RL|Proc. IEEE Conf.<br>Evolutionary<br>Computation|Early combination of<br>genetic algorithms with<br>RL for cooperative traf-<br>fic signal control| |Classic|2003|Abdul

3. `rt-grp-1-report.pdf` Automated Traffic Signal Control > |A |∑ > Difference (score None)
   > ∼26 3DQN (ours) 66.02 ± 6.31 +154% ∼35 Fixed-30s 37.73 ± 4.87 +7.8% ∼41 Fixed-40s 51.76 ± 5.09 +24% Critical Analysis: Our Fixed-30s baseline (37.73s) closely matches the paper’s result (35s) with only 7.8% difference, validating that our SUMO environment, traffic generation, metric calculation, and

4. `CM4607 Esandu Report.pdf` Results and Discussion > Experimental Results > Performance Improvements (score None)
   > Figure 4 visualizes the relative improvements achieved by each method over the baseline. Figure 4: Performance improvements over baseline: Q-Learning achieves 42.1% reduction in average waiting time, while GA achieves 51.3% reduction, demonstrating the superiority of evolutionary optimization for th

5. `CM4607 Esandu Report.pdf` Results and Discussion > Analysis and Discussion > Genetic Algorithm Performance (score None)
   > The GA-optimized solution achieved: • 51.3% reduction in average waiting time (3.011s →1.468s) • 31.3% reduction in average queue length (3.84 →2.64 vehicles) • Maintained throughput at 1,960 vehicles (comparable to baseline) Key Findings:

---

## Q11 · lookalike_trap · `lookup`

**Q.** In the GreenGuard paper's SOTA comparison table (Table II), what accuracy figure is reported for Xie et al.'s Swin-Transformer-based method on the Chaozhou Dancong tea dataset?

**Expected passage.** GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf, passage 14
> Xie et al. [1] Chaozhou Dancong Tea dataset (Self-made dataset) 5 Swim Transformer depth learning algorithm with migration learning

**Expected answer.** 94% (reported as 'Detection accuracy').

**Retrieved** (5 passages), expected at rank **1**

1. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |Author|Dataset|Number<br>of<br>disease<br>classes|Method|Accuracy Metrics|Accuracy| |---|---|---|---|---|---| |Singh et al. [7]|900 high resolution im-<br>ages|7|Convolutional 2D model|Precision,<br>Recall,<br>F1-<br>score|Classiﬁcation<br>accuracy-<br>84.5%| |Divya Praba et al.<br>[8]|UAV dataset|

2. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > information on the screen by displaying the disease name, MobileNetV2. Additionally, the impact of different optimizers reasons, symptoms, and remedies. (Adam, RMSprop, Adamax) and data augmentation techniques was also investigated, and among the optimizers, Adamax VI. RESULTS AND DISCUSSION demonst

3. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |leaf diseases|in the literat|ure. With the|help of|Convolutional<br>|disease remed|ie|s, it would be|a great oppo|rtunit|y for farmers| |Neural Netw|orks (CNN),|proposed|a disease|classiﬁcation<br>|to get notiﬁed|a|bout their cul|tivation using|their|smartphones.| |model [7], a|nd it recorde|d 84.5

4. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |178|**system that can accurately identify ail**<br>|** ments and sug**<br>|** gest relevant**<br>|climate due to global|arming, ba|cteria|infections|from some| |5-|**treatments. The proposed Convolutio**|**nal Neural Net**|**work (CNN)**|<br>other plants, and lack o|<br> f fertilizers.

5. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > |<br>remedy sugg|<br> estions, while|<br> section V f|<br> ocuses on|<br> front-end and<br> <br>|promising arc<br>|hit<br>|ecture which<br>|consists of sk<br>|ip con<br>|nections, and<br>| |<br>back-end de|<br>velopment. R|<br>esults and d|<br>iscussion|<br> are included<br> <br>|it help

---

## Q12 · lookalike_trap · `lookup`

**Q.** According to the CM4608 feedback grid (the grading table, not the main task description), what subset size must an Excellent (Grade A) Task 1 submission clearly identify through EDA?

**Expected passage.** CM4608_Assessment_Brief_Coursework.pdf, passage 13
> Collected a large dataset from which a diverse subset of at least 15,000 was clearly identified using carefully selected informative exploratory data analysis.

**Expected answer.** At least 15,000 - this is a different figure from the 50,000-entry minimum raw collection required in the main task description earlier in the same brief.

**Retrieved** (5 passages), expected at rank **4**

1. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |**Task(s) - content**<br>_10 years ago, there was an article1 stating that the r/srilanka subreddit on the Reddit platform was not a_<br>_natural choice for Sri Lankans until 2013 or so, when the number subscribing went past 1000.

2. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |_based on the template given, where RGUID should be replaced by your RGU ID number. For each such part,_<br>_a descriptive summary with an interpretation of the output should be given each executable cell. You also_<br>_need to su

3. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |How will I be graded?|Col2| |---|---| |**A **|At least 50% of the subgrades to be at Grade A, at least 80% of the subgrades to be at Grade B<br>or better, and normally 100% of the subgrades to be at Grade C or better.| |**B **|At least 50% of the subgrades to be at Grade B or better, at least 80% o

4. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Feedback grid (score None)
   > |GRADE|A|B|C|D|E|F| |---|---|---|---|---|---|---| |**DEFINITION**<br>**CRITERIA**<br>**(WEIGHTING**|** /**<br>**)**<br>**EXCELLENT**<br>Outstanding<br>Performance|**COMMENDABLE/VERY GOOD**<br>Meritorious<br>Performance|<br>**GOOD**<br>Highly Competent<br>Performance|**SATISFACTORY**<br>Competent<br>

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Feedback grid > Date created: August 2023 (score None)
   > |GRADE|A|B|C|D|E|F| |---|---|---|---|---|---|---| |**DEFINITION /**<br>**CRITERIA**<br>**(WEIGHTING)**|**EXCELLENT**<br>Outstanding<br>Performance|**COMMENDABLE/VERY GOOD**<br>Meritorious<br>Performance|<br>**GOOD**<br>Highly Competent<br>Performance|**SATISFACTORY**<br>Competent<br>Performance|**BO

---

## Q13 · conflicting_versions · `lookup`

**Q.** What crossover probability did the GA in CM4607 use?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 54, 59
> The crossover probability of 75% ensures that 25% of individuals pass to the next generation unchanged

**Expected answer.** The document actually gives two different figures for this. The two-point crossover operator is formally defined with Pc = 0.7 (70%), but the justification paragraph right after it, and the Table 4 methodology summary, both state 75% instead. A careful answer should flag this inconsistency and give both values, noting that 75% is the one repeated twice (justification text + summary table) versus 70% stated once (the formal definition).

**Retrieved** (5 passages), expected at rank **1**

1. `CM4607 Esandu Report.pdf` Methodology > Genetic Operators > Crossover: Two-Point Crossover (score None)
   > Two-point crossover was applied with probability Pc = 0.7 (70%) to create offspring from selected parents. The operator randomly selects two crossover points within the chromosome, then exchanges the genetic material between these points. Mechanism: [g1, g2 | g3, g4, g5 | g6, g7, g8] Parent 1: [h1,

2. `CM4607 Esandu Report.pdf` Contents > Methodology (score None)
   > 3.1 Holistic System Architecture . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 3.2 Modularized System Architecture . . . . . . . . . . . . . . . . . . . . . . . . . . . 3.3 Chromosome Structure . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 3.3.1 Encoding Scheme . . .

3. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |What is expected of me in this assessment?<br>(c) Evaluate the effectiveness of these tokenization schemes by analyzing their impact on corpus statistics<br>(total words, unique words) and recommend the most suitable tokenization scheme for subsequent<br>LLM tasks, using the perplexity metric based

4. `NLP_CWReport_2237041.pdf` Natural Language Processing > Coursework Report > Part A: Reflective Report On Learning Process > Use of Generative AI (score None)
   > 1. For code formatting, used to format the code to give the output in a better understanding way, makes the displayed output more understandable. 2. Making a dictionary consisting of Sri Lanka keywords for Reddit scraping. This allowed me to save time and to make a balanced list of topics for each m

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |_based on the template given, where RGUID should be replaced by your RGU ID number. For each such part,_<br>_a descriptive summary with an interpretation of the output should be given each executable cell. You also_<br>_need to su

---

## Q14 · summary · `summarize`

**Q.** Summarise how SmartSmile's model-retraining pipeline works, from a low-confidence X-ray detection to an updated model reaching users' phones.

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 25, 28
> A nightly Lambda job syncs these to a training dataset.

**Expected answer.** A detection below the confidence threshold is flagged and the image is uploaded to S3 via a Lambda function. A dentist reviews and annotates it in Label Studio (hosted on Elastic Beanstalk). A nightly Lambda job syncs the new annotations back to S3 as training data. Once enough new labelled samples exist, an AWS EventBridge-triggered Lambda kicks off a SageMaker notebook that fine-tunes the YOLOv10 model and validates its performance. The updated model is then deployed and distributed to end devices in a future app version.

**Retrieved** (4 passages), expected at rank **1**

1. `Group 27 - report - SmartSmile edgeAI.pdf` System Architecture & Design > Workflow Sequence (score None)
   > 1.​ User Upload & Inference a.​ The app preprocesses the X-ray and runs YOLOv10 locally. b.​ Confidence Check: i.​ High (≥50%): Annotated image shown immediately. ii.​ Low (<50%): Original image flagged for expert review. 2.​ Cloud Processing a.​ Images are uploaded to S3 via Lambda, with file data

2. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Use case descriptions > Use Case 3: Review Low-Confidence Predictions > Primary Actor: Doctor Description: Healthcare professionals review dental X-ray images (score None)
   > where the AI model had low confidence in its detections.. Preconditions: Doctor is authenticated in the application with appropriate permissions. Main Flow: 1.​ Doctor logs into the application 2.​ System displays a queue of X-rays requiring review 3.​ Doctor selects an X-ray from the queue 4.​ Syst

3. `Group 27 - report - SmartSmile edgeAI.pdf` Introduction > Problem Statement (score None)
   > Currently, dental tourists have no way to get an initial understanding of their dental health before visiting a clinic overseas. While OPG X-rays are an effective tool for early diagnosis, there is no streamlined system to analyze these images remotely. As a result, travelers are left to plan their

4. `GreenGuard_Mobile_Application_for_Real-Time_Tea_Leaves_Disease_Detection_and_Treatment_Guidance.pdf`  (score None)
   > ||<br>|<br>|<br>|[9]|V.<br>Tanwar<br>and<br>S.<br>Lamba,<br>“Tea<br>Leaf<br>Diseases<br>Classi|cation| |a<br>|custom CNN <br>|model a<br>|tained an impressive 94% accuracy,<br>||and Detection using a Convolutional Neural Network,” in|_2023_| |d|emonstrating th|e effecti|veness of the proposed approa

---

## Q15 · vague_wording · `lookup`

**Q.** hey random q but like how many interns or w/e did esandu end up managing on that powerprox telecom thing lol

**Expected passage.** cm306_esandu_final_report.docx, passage 3
> I am like the team lead, project manager, I have roughly 10 interns under me, that I have to assign the tasks , review once done, integrate to the main

**Expected answer.** Roughly 10 interns.

**Retrieved** (5 passages), expected at rank **1**

1. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 3. ROLE(S) AND ACTIVITIES (score 0.83203125)
   > During my internship at SLT Telecom, I contributed to four significant projects, showcasing my versatility and technical capabilities. 1. PowerProx (Power at Your Fingertips) As my main project, I developed various features for this mobile application designed to manage power assets and employees i

2. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT (score 0.392578125)
   > Name: Esandu Meth Obadaarachchi IIT : 20221333 RGU : 2237041 Degree: Bsc AI and Data science Organization: SLT Telecom Placement Period: [1/7/2024 – 1/6/2025]

3. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 1. INTRODUCTION (score 0.38671875)
   > This report documents my industrial placement experience at SLT Telecom, where I worked as an intern focused on mobile and web application development, particularly using Flutter,React and applying machine learning techniques to build AI-powered systems. During this period, I actively contributed to

4. `cm306 esandu final report.docx` INDUSTRIAL PLACEMENT FINAL REPORT > 2. PLACEMENT BACKGROUND (score 0.375)
   > SLT Telecom is a telecommunications company in Sri Lanka. During my placement, I worked in the Power and AC section and the Digital Platform section, focusing on mobile and web application development. My primary responsibilities involved developing applications using Flutter, implementing machine l

5. `SLT PowerProx solution architecture.docx` Solution Overview (score 0.322265625)
   > PowerProx is a centralized web-based solution developed to support the management, operation, and maintenance of critical power infrastructure assets within Sri Lanka Telecom (SLT). The system provides a unified platform for managing infrastructure assets, operational activities, inspections, fault

---

## Q16 · unanswerable · `lookup`

**Q.** What is the total budget approved for migrating SLT's servers from the IDC to the new data center?

**Expected.** A refusal: the corpus does not answer this.

**Retrieved** (5 passages), expected at rank **not retrieved**

1. `SLT_Server_Migration_Proposal.docx` 1. Executive Summary (score None)
   > This proposal outlines the architecture and plan for migrating the current application and database servers hosted at the IDC (Internet Data Center) to the company's new IT data center. The migration covers 5 frontend applications (PowerProx Web, PowerZenith, SLT Solar Dashboard, Admin Overview Dash

2. `SLT_Server_Migration_Proposal.docx`  (score None)
   > Sri Lanka Telecom Server Migration Proposal Migration of Application Servers from the IDC to the New IT Data Center

3. `SLT_Server_Migration_Proposal.docx` 9. Rollback Plan (score None)
   > The old IDC environment remains fully running and untouched throughout the migration DNS / internal routing is only repointed to the new servers after each component is verified working If a critical issue is found post-cutover, traffic can be redirected back to the IDC servers, which remain avail

4. `SLT_Server_Migration_Proposal.docx` 3. Objectives (score None)
   > Relocate all services from the IDC to the new IT data center with minimal downtime Improve isolation between application logic and databases for better security and reliability Keep server resource allocation lean and cost-conscious, scaling only as real usage demands Establish a clear rollback p

5. `SLT_Server_Migration_Proposal.docx` 10. Conclusion (score None)
   > This proposal favors a lean, phased approach: a two-server split that keeps databases isolated from the application tier, a migration order that de-risks the process by tackling the lowest-risk components first, and a starting sizing allocation that avoids over-provisioning while leaving a clear pat

---

## Q17 · unanswerable · `lookup`

**Q.** What overall grade or mark did Esandu receive for the CM4608 Natural Language Processing coursework?

**Expected.** A refusal: the corpus does not answer this.

**Retrieved** (5 passages), expected at rank **not retrieved**

1. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |How will I be graded?|Col2| |---|---| |**A **|At least 50% of the subgrades to be at Grade A, at least 80% of the subgrades to be at Grade B<br>or better, and normally 100% of the subgrades to be at Grade C or better.| |**B **|At least 50% of the subgrades to be at Grade B or better, at least 80% o

2. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework (score None)
   > |Academic Year|Col2|2025-26| |---|---|---| |**Semester**||**1 **| |**Module Number**||**CM4608**| |**Module Title**||**Natural Language Processing**| |**Assessment Method**||**Individual Coursework**| |**Deadline (time and date)**||**28th November 2025 – 12 midnight**| |**Submission**|**Submission**

3. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework (score None)
   > |What knowledge and/or skills will I develop by undertaking the assessment?|Col2| |---|---| |_Students will be able to collect and preprocess real-world social media data, establish programmatic_<br>_'ground truth', apply traditional machine learning, deep learning, and transformer models for text_<

4. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |**Task(s) - content**<br>_10 years ago, there was an article1 stating that the r/srilanka subreddit on the Reddit platform was not a_<br>_natural choice for Sri Lankans until 2013 or so, when the number subscribing went past 1000.

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > How will I be graded? A number of subgrades will be provided for each criterion on the feedback grid which is specific to the assessment. The overall grade for the assessment will be calculated using the algorithm below*. [Amend as appropriate to your module.]

---

## Q18 · false_premise · `lookup`

**Q.** Why was the mutation probability in the CM4607 GA raised to 40%?

**Expected passage.** CM4607_Esandu_Report.pdf, passage 55
> Uniform integer mutation was applied with probability Pm = 0.25 (25%) to introduce genetic diversity and prevent premature convergence.

**Expected answer.** The premise is wrong on two counts: the mutation probability was never 40%, and it was never 'raised' - it's a fixed setting. The document states Pm = 0.25 (25%), with a separate per-gene probability indpb = 0.3 (30%) governing which individual genes actually get replaced when mutation is triggered. A correct answer must reject the 40% figure rather than inventing a justification for it.

**Retrieved** (5 passages), expected at rank **2**

1. `CM4607 Esandu Report.pdf` Methodology > Genetic Operators > Justification: Uniform mutation enables large exploratory jumps across the search space, (score 0.64453125)
   > preventing the GA from becoming trapped in local optima, facilitating exploration of distant regions. This is critical because crossover alone can only recombine existing genetic material mutation introduces entirely new values not present in the initial population.

2. `CM4607 Esandu Report.pdf` Methodology > Genetic Operators > Mutation: Uniform Integer Mutation (score 0.5)
   > Uniform integer mutation was applied with probability Pm = 0.25 (25%) to introduce genetic diversity and prevent premature convergence. For each selected individual, each gene has an independent probability indpb = 0.3 (30%) of being replaced with a random integer uniformly sampled from the range [2

3. `CM4607 Esandu Report.pdf` Methodology > Methodology Summary > Justification (score 0.49609375)
   > Chromosome 8 integer genes [20-75] Direct encoding, interpretable f = 100W + 20Qavg + 10Qmax −0.5T + P Fitness Multi-objective balance Constraints Green: [20,75]s, Cycle: [40,140]s Safety + efficiency Population 20 individuals Sufficient diversity Generations Convergence observed Selection Tournamen

4. `CM4607 Esandu Report.pdf` Results and Discussion > Analysis and Discussion > Conclusion: While both Q-Learning (computational intelligence via RL) and GA (computa- (score 0.41015625)
   > tional intelligence via EA) improved significantly over the analytical baseline, GA’s populationbased evolutionary search proved more effective for this discrete, expensive-evaluation, black-box optimization problem.

5. `CM4607 Esandu Report.pdf` Problem Definition > Justification for Evolutionary Algorithms > Conclusion (score 0.408203125)
   > While multiple theoretical approaches exist, Genetic Algorithms provide the optimal balance of: • Effectiveness: Demonstrated ability to find high-quality solutions • Efficiency: Reasonable computational requirements (320 evaluations) • Implementability: Outputs deployable, interpretable solutions •

---

## Q19 · groundedness_trap · `explore`

**Q.** What are all the ways SmartSmile secures patient data, including exactly which encryption algorithm and key-management scheme it uses?

**Expected passage.** Group_27_-_report_-_SmartSmile_edgeAI.pdf, passage 22, 24
> FR8.1: The system shall encrypt all patient data at rest and in transit

**Expected answer.** The document only specifies requirements at a high level: patient data is encrypted at rest and in transit (FR8.1), captured images are kept in encrypted local storage (FR2.5), patient identifiers are anonymized before cloud transmission (FR8.2), all data access is audit-logged (FR8.3), role-based access controls are applied (FR8.4), and on the cloud side, AWS IAM roles and AWS Systems Manager Parameter Store manage permissions and secrets. It does NOT name a specific encryption algorithm (e.g. AES-256) or a specific key-management scheme anywhere. A grounded answer must say this detail isn't specified rather than inventing one.

**Retrieved** (5 passages), expected at rank **1**

1. `Group 27 - report - SmartSmile edgeAI.pdf` System Architecture & Design > Architectural Components (score None)
   > 1.​ Mobile Application (Edge Device) a.​ Framework: Built with Flutter for cross-platform compatibility. b.​ Key Functions: i.​ Captures/uploads dental OPG images. ii.​ Runs on-device inference using the YOLOv10 model (using TensorFlow Lite as it is more optimized for mobile). iii.​ Displays annotat

2. `Group 27 - report - SmartSmile edgeAI.pdf` System Requirement Specification > Functional requirements > FR8: Security and Privacy (score None)
   > ●​ FR8.1: The system shall encrypt all patient data at rest and in transit ●​ FR8.2: The system shall anonymize patient identifiers before cloud transmission ●​ FR8.3: The system shall maintain audit logs of all data access and modifications ●​ FR8.4: The system shall implement appropriate access co

3. `SLT PowerProx solution architecture.docx` Data Architecture > Overview (score None)
   > The PowerProx data architecture provides centralized storage and management of the operational information required by the application. The data layer supports the business modules by maintaining structured records related to assets, inspections, maintenance activities, faults, employees, requests,

4. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score None)
   > |_(c) Evaluate the effectiveness of these tokenization schemes by analyzing their impact on corpus statistics_<br>_(total words, unique words) and recommend the most suitable tokenization scheme for subsequent_<br>_LLM tasks, using the perplexity metric based on an appropriate ‘test’ set. Recommend

5. `Group 27 - report - SmartSmile edgeAI.pdf` System Architecture & Design > UI Design (score None)
   > The UI design includes wireframe mockups of the mobile application screens: 1.​ Login/Registration Screen 2.​ Home Screen 3.​ X-ray Upload Screen 4.​ Patient History Screen

---

## Q20 · out_of_scope · `lookup`

**Q.** What's the capital of France?

**Expected.** A refusal: the corpus does not answer this.

**Retrieved** (5 passages), expected at rank **not retrieved**

1. `CM4607 Esandu Report.pdf` Contents > Introduction (score 0.30859375)
   > 1.1 Background . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1.2 Problem Statement . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1.3 Research Objectives . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1.4 Contributions . . .

2. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score 0.294921875)
   > |Col1|Col2|Col3| |---|---|---| ||What is expected of me in this assessment?||

3. `rt-grp-1-report.pdf` Automated Traffic Signal Control > Appendix A: RL Algorithms > Middle Implementation : paper 4 (score 0.29296875)
   > self.alpha = alpha self.buffer = [] self.priorities = [] self.position = 0 def push(self , state , action , reward , next_state , done): max_priority = max(self.priorities) if self.priorities else 1.0 if len(self.buffer) < self.capacity: self.buffer.append ((state , action , reward , next_state , do

4. `Group 27 - report - SmartSmile edgeAI.pdf` Introduction > Problem Background > Dental Tourism and the Planning Challenge​ (score 0.2890625)
   > Dental tourism is increasingly popular as people seek affordable or specialized dental care abroad. However, a key issue for dental tourists is the lack of a preliminary diagnosis before traveling. Without any initial insights into their dental condition, they are unable to plan effectively—uncertai

5. `CM4608 Assessment Brief Coursework.pdf` Assessment Brief - Coursework > Date created: August 2023 (score 0.287109375)
   > |Col1|What is expected of me in this assessment?|Col3| |---|---|---| |_based on the template given, where RGUID should be replaced by your RGU ID number. For each such part,_<br>_a descriptive summary with an interpretation of the output should be given each executable cell. You also_<br>_need to su

---
