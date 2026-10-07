import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import FlexCarousel from './FlexCarousel.jsx';

const projects = [
  {
    src: './assets/projects/project-1.jpg', alt: '家庭诊室智慧屏项目封面', title: '家庭诊室智慧屏', subtitle: '智慧医疗 / 多端体验', pdf: './assets/pdfs/project-1-home-medical.pdf',
    intro: '家庭诊室是百岁居旗下面向老年人与家庭照护者的智慧健康管理终端，通过智慧屏与手机端协同，将健康检测、结果解读、异常提醒、视频问诊与在线购药串联为完整服务闭环。在项目中负责核心体验策略、适老化界面设计及跨模块搭建；前期参与用户研究、需求分析与信息架构规划，围绕“看得清、点得准、学得会、敢使用”建立适老化设计原则；重点完成首页、健康检测、健康报告、医疗商城与会员体系等核心模块，并协同产品及开发推进原型验证、视觉规范与设计落地。',
    outcome: '通过适老化设计与双端数据协同，降低老人健康操作门槛，将单次检测延伸为家人共看、异常关注、就医咨询与在线购药的持续健康管理链路。服务注册用户10万+，累计完成健康检测520万+次；检测任务完成率达到91.2%，月活跃率79.66%、商城购买转化率20.2%。'
  },
  {
    src: './assets/projects/project-2.jpg', alt: '小旅星 app 项目封面', title: '小旅星app', subtitle: '移动端 / AI 旅行规划', pdf: './assets/pdfs/project-2-trip-starmate.pdf',
    intro: '该产品是一款AI赋能的全链路旅游规划软件，本次项目为产品核心改版升级，服务旅游爱好者多场景出行需求。主要负责全链路视觉界面设计与输出，主导产品体验优化与版本迭代；前期配合产品经理完成需求分析、原型搭建，后期协同开发团队保障设计还原度与产品体验一致性。',
    outcome: '主导全产品体验改版，重构复杂行程规划界面，优化交互流程，用户操作便捷性较行业均值提升30%，核心行程规划转化率提升22%，新用户7日留存率提升18%，设计还原度稳定在95%以上，产品易用性获得用户高度好评。'
  },
  {
    src: './assets/projects/project-3.jpg', alt: 'b 端服装品牌管理系统项目封面', title: 'b端服装品牌管理系统', subtitle: 'B 端 / 数据可视化', pdf: './assets/pdfs/project-3-fashion-management.pdf',
    intro: '该产品是专为服装零售品牌打造的全链路智慧管理平台，集商品管理、用户运营、订单处理、员工管理、数据决策于一体，助力企业降本增效、高效协作。主要负责B端界面视觉设计与交互优化，保障设计风格与品牌调性统一，贴合业务需求打磨产品体验。',
    outcome: '深度调研商家业务流程，重构复杂操作界面，优化信息层级与交互逻辑，商家核心操作效率提升35%，团队设计复用率提升至90%，设计交付周期缩短30%，有效助力品牌实现全链路数据打通与降本增效，获得业务部门高度认可。'
  },
  {
    src: './assets/projects/project-4.jpg', alt: '智慧公交大屏项目封面', title: '智慧公交大屏', subtitle: '智慧大屏 / 数据监控', pdf: './assets/pdfs/project-4-smart-bus.pdf',
    intro: '该产品是服务于城市公交运营管理的一体化数据可视化平台，深度整合多源运营数据，实现对公交车辆、线路、人员的全链路动态管理，助力运营管理者科学决策与精细化调度。主要负责智慧大屏的数据可视化界面设计，优化复杂数据的直观呈现，提升决策效率与展示效果。',
    outcome: '重构数据可视化逻辑，搭建专业大屏视觉体系，管理者核心数据获取效率提升50%，公交调度决策效率提升40%，大屏展示效果获得运营部门高度认可，助力城市公交实现精细化运营。'
  },
  {
    src: './assets/projects/project-5.jpg', alt: '微服务大厅智慧大屏项目封面', title: '微服务大厅智慧大屏', subtitle: '业务平台 / 数据大屏', pdf: './assets/pdfs/project-5-microservice-hall.pdf',
    intro: '该产品是服务于政务/企业微服务管理的一体化数据可视化平台，整合多业务线运营数据，实现服务流程、业务数据的全链路动态监控，助力管理者高效决策。主要负责大屏数据可视化界面设计，优化复杂数据呈现，提升监控效率与展示效果。',
    outcome: '重构数据可视化逻辑，搭建专业视觉体系，管理者核心数据获取效率提升50%，业务监控响应速度提升40%，大屏展示效果获得管理部门高度认可，助力微服务大厅实现精细化运营。'
  },
  {
    src: './assets/projects/project-6.jpg', alt: 'HMI 车载界面项目封面', title: 'HMI车载界面', subtitle: '车载系统 / 交互体验', pdf: './assets/pdfs/project-6-hmi.pdf',
    intro: '智能座舱已成为汽车智能化竞争的核心赛道，年轻消费群体的崛起与出行场景的多元化，正在重塑用户对车载交互的期待。传统车载界面的功能割裂、视觉同质化，已无法满足用户对沉浸式体验、个性化表达与便捷操控的需求。伴随自动驾驶技术迭代，座舱也逐渐成为移动的生活与社交场景。',
    outcome: '项目以构建更懂用户的下一代车载 HMI 系统为目标，围绕简洁清晰、自然直观、灵活有序、高级精致四项原则，梳理中控组件、导航、音乐、空调、车辆状态与快捷触控区域。'
  },
  {
    src: './assets/projects/project-7.jpg', alt: '润培官网项目封面', title: '润培官网', subtitle: '品牌网站 / 电商体验', pdf: './assets/pdfs/project-7-roopy.pdf',
    intro: '润培香氛官方宣传网站改版项目，主要展示品牌产品、香氛文化、品牌故事及购买渠道。目标用户包括追求精致生活的年轻女性消费者、线下渠道采购商、品牌合作伙伴与香氛爱好者。',
    outcome: '改版聚焦旧站视觉风格陈旧、信息展示不足、购买流程繁复与多设备适配不佳等问题，提升网站浏览效率、品牌质感、生活美学表达与消费转化体验。'
  },
  {
    src: './assets/projects/project-8.jpg', alt: 'Shopbop 网站项目封面', title: 'Shopbop 网站', subtitle: '网页设计 / 电商体验', pdf: './assets/pdfs/project-8-shopbop.pdf',
    intro: '该项目为shopbop服装零售品牌电商首页视觉重构与体验优化，核心目标是提升商品展示效果、优化用户转化路径，带动店铺销售增长。主要负责首页视觉设计、信息架构优化、交互流程打磨，保障视觉风格与品牌调性统一，贴合用户浏览习惯。',
    outcome: '完成电商首页视觉重构，优化商品展示与转化路径，首页核心商品点击率提升28%，用户浏览深度提升20%，店铺核心品类转化率提升22%，有效带动店铺销售业绩增长。'
  }
];

function PortfolioProjects() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusOpen, setFocusOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const activeProject = projects[activeIndex];

  const openPdf = project => {
    setModalOpen(false);
    window.dispatchEvent(new CustomEvent('portfolio:open-pdf', {
      detail: { url: project.pdf, title: `${project.title} 项目作品集` }
    }));
  };

  useEffect(() => {
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen]);

  const focusActions = (
    <div className="project-focus-actions" data-carousel-action>
      <button type="button" onClick={() => setModalOpen(true)}>项目文字简介</button>
      <button className="project-pdf-button" type="button" onClick={() => openPdf(activeProject)}>项目pdf</button>
    </div>
  );

  return (
    <>
      <FlexCarousel
        items={projects}
        preset="ribbon"
        lensWidth={0.71}
        lensHeight={0.73}
        tilt={0}
        reach={0.34}
        dispersion={0.4}
        intro="bloom"
        fit="natural"
        gap={15}
        cardHeight={0.48}
        radius={14}
        bend={0.34}
        roundness={1}
        curl="twist"
        liquid={0}
        followCursor={false}
        squeeze={0.2}
        focusOnClick
        captions
        captureWheel
        onChange={index => {
          setActiveIndex(index);
          setModalOpen(false);
        }}
        onFocusChange={(open, index) => {
          setFocusOpen(open);
          if (index >= 0) setActiveIndex(index);
          if (!open) setModalOpen(false);
        }}
        focusActions={focusOpen ? focusActions : null}
      />

      {modalOpen && createPortal(
        <div className="project-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
            <div className="project-modal-head">
              <div>
                <p>{activeProject.subtitle}</p>
                <h3 id="project-modal-title">{activeProject.title}</h3>
              </div>
              <button ref={closeButtonRef} className="project-modal-close" type="button" onClick={() => setModalOpen(false)}>关闭</button>
            </div>
            <div className="project-modal-content">
              <div>
                <h4>项目简介</h4>
                <p>{activeProject.intro}</p>
              </div>
              <div>
                <h4>设计成果</h4>
                <p>{activeProject.outcome}</p>
              </div>
            </div>
            <div className="project-modal-footer">
              <button type="button" onClick={() => openPdf(activeProject)}>查看pdf</button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

const mount = document.querySelector('#project-carousel');

if (mount) createRoot(mount).render(<PortfolioProjects />);
